import type { SQL } from 'bun';
import { type Team, type TeamRepository, teamSchema } from '@schediochron/core';

/**
 * Thrown when a membership mutation would leave a team with no admin. The API
 * layer maps this to 409 Conflict. ADR-004's "at least one admin" invariant is
 * not expressible as a row constraint, so it is enforced here, inside the
 * mutations, atomically with the write it guards.
 */
export class LastAdminError extends Error {
  readonly teamId: string;
  readonly userId: string;

  constructor(teamId: string, userId: string) {
    super(
      `Cannot remove the last admin (user ${userId}) of team ${teamId} — a team must always have at least one admin.`,
    );
    this.name = 'LastAdminError';
    this.teamId = teamId;
    this.userId = userId;
  }
}

/**
 * A single row of the `team_members` join table as it appears inside the
 * aggregated team read (see {@link TEAM_SELECT}).
 */
interface MemberJson {
  userId: string;
  isAdmin: boolean;
}

/** A `teams` row joined with its aggregated membership. */
interface TeamRow {
  id: string;
  name: string;
  created_at: Date | string;
  updated_at: Date | string;
  members: MemberJson[];
}

/**
 * Any tagged-template SQL executor — the top-level client or a transaction
 * handle (`TransactionSQL extends SQL`). Reads and writes take one so the same
 * helper runs both standalone and inside `sql.begin`.
 */
type Executor = SQL;

/**
 * The read shape for a team: the scalar columns plus its membership aggregated
 * into a single JSON array, so one row fully describes one team. `is_admin`
 * marks the admins among the members, exactly as the join table stores it.
 *
 * TODO(#…): extract shared row mapping once a second repository needs it.
 */
const TEAM_SELECT = `
  SELECT
    t.id,
    t.name,
    t.created_at,
    t.updated_at,
    COALESCE(
      (
        SELECT json_agg(
                 json_build_object('userId', tm.user_id, 'isAdmin', tm.is_admin)
                 ORDER BY tm.created_at, tm.user_id
               )
        FROM team_members tm
        WHERE tm.team_id = t.id
      ),
      '[]'::json
    ) AS members
  FROM teams t`;

/** Normalises a `timestamptz` (Bun hands these back as `Date`) to ISO 8601 UTC. */
function toIso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

/**
 * Assembles the two-array {@link Team} model from a join-table read. `memberIds`
 * is every participant; `adminIds` is the admins among them — so `adminIds ⊆
 * memberIds` holds by construction, never by a separate check.
 *
 * Exported for unit testing; not part of the package's public API.
 */
export function mapTeamRow(row: TeamRow): Team {
  const members = row.members ?? [];
  return {
    id: row.id,
    name: row.name,
    memberIds: members.map((m) => m.userId),
    adminIds: members.filter((m) => m.isAdmin).map((m) => m.userId),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

/**
 * PostgreSQL-backed {@link TeamRepository} over the `teams` / `team_members`
 * join table.
 *
 * The `Team` model's `adminIds`/`memberIds` are assembled from join rows on read
 * and decomposed into them on write. Every membership mutation runs in a single
 * transaction so ADR-004's invariants — `adminIds ⊆ memberIds`, at least one
 * admin — hold atomically; none is a read-modify-write of the whole team.
 */
export class SqlTeamRepository implements TeamRepository {
  constructor(private readonly sql: SQL) {}

  async findById(id: string): Promise<Team | null> {
    return this.load(this.sql, id);
  }

  async findAll(): Promise<Team[]> {
    const rows = await this.sql<
      TeamRow[]
    >`${this.sql.unsafe(TEAM_SELECT)} ORDER BY t.created_at, t.id`;
    return rows.map(mapTeamRow);
  }

  async findByUserId(userId: string): Promise<Team[]> {
    const rows = await this.sql<TeamRow[]>`
      ${this.sql.unsafe(TEAM_SELECT)}
      WHERE EXISTS (
        SELECT 1 FROM team_members m
        WHERE m.team_id = t.id AND m.user_id = ${userId}
      )
      ORDER BY t.created_at, t.id`;
    return rows.map(mapTeamRow);
  }

  async create(team: Team): Promise<Team> {
    // teamSchema enforces adminIds non-empty and adminIds ⊆ memberIds; fail loud.
    const valid = teamSchema.parse(team);
    const admins = new Set(valid.adminIds);
    return this.sql.begin(async (tx) => {
      await tx`INSERT INTO teams (id, name) VALUES (${valid.id}, ${valid.name})`;
      for (const userId of valid.memberIds) {
        await tx`
          INSERT INTO team_members (team_id, user_id, is_admin)
          VALUES (${valid.id}, ${userId}, ${admins.has(userId)})`;
      }
      return this.require(tx, valid.id);
    });
  }

  /**
   * Authoritative replace of a team's name and full membership. Validated by
   * teamSchema (so the invariants hold) and applied in one transaction, which is
   * what makes a whole-team write safe here where a piecemeal one would not be.
   */
  async update(team: Team): Promise<Team> {
    const valid = teamSchema.parse(team);
    const admins = new Set(valid.adminIds);
    return this.sql.begin(async (tx) => {
      const updated = await tx`
        UPDATE teams SET name = ${valid.name}, updated_at = now()
        WHERE id = ${valid.id} RETURNING id`;
      if (updated.length === 0) throw new Error(`Team ${valid.id} not found.`);
      await tx`DELETE FROM team_members WHERE team_id = ${valid.id}`;
      for (const userId of valid.memberIds) {
        await tx`
          INSERT INTO team_members (team_id, user_id, is_admin)
          VALUES (${valid.id}, ${userId}, ${admins.has(userId)})`;
      }
      return this.require(tx, valid.id);
    });
  }

  /** Deleting an unknown id is a no-op; `ON DELETE CASCADE` clears membership. */
  async delete(id: string): Promise<void> {
    await this.sql`DELETE FROM teams WHERE id = ${id}`;
  }

  async addMember(teamId: string, userId: string): Promise<Team> {
    return this.sql.begin(async (tx) => {
      await this.assertTeamExists(tx, teamId);
      const inserted = await tx`
        INSERT INTO team_members (team_id, user_id, is_admin)
        VALUES (${teamId}, ${userId}, false)
        ON CONFLICT (team_id, user_id) DO NOTHING
        RETURNING user_id`;
      if (inserted.length > 0) await this.touch(tx, teamId);
      return this.require(tx, teamId);
    });
  }

  async removeMember(teamId: string, userId: string): Promise<Team> {
    return this.sql.begin(async (tx) => {
      await this.assertTeamExists(tx, teamId);
      const adminIds = await this.adminIds(tx, teamId);
      const isAdmin = adminIds.includes(userId);
      if (isAdmin && adminIds.length === 1) {
        throw new LastAdminError(teamId, userId);
      }
      const deleted = await tx`
        DELETE FROM team_members
        WHERE team_id = ${teamId} AND user_id = ${userId}
        RETURNING user_id`;
      if (deleted.length > 0) await this.touch(tx, teamId);
      return this.require(tx, teamId);
    });
  }

  async assignAdmin(teamId: string, userId: string): Promise<Team> {
    return this.sql.begin(async (tx) => {
      await this.assertTeamExists(tx, teamId);
      // Insert the membership if absent, promote it if present — both or neither,
      // in one statement. The DO UPDATE ... WHERE skips a no-op re-promotion so
      // updated_at only moves when something actually changed.
      const changed = await tx`
        INSERT INTO team_members (team_id, user_id, is_admin)
        VALUES (${teamId}, ${userId}, true)
        ON CONFLICT (team_id, user_id) DO UPDATE SET is_admin = true
        WHERE team_members.is_admin IS DISTINCT FROM true
        RETURNING user_id`;
      if (changed.length > 0) await this.touch(tx, teamId);
      return this.require(tx, teamId);
    });
  }

  async removeAdmin(teamId: string, userId: string): Promise<Team> {
    return this.sql.begin(async (tx) => {
      await this.assertTeamExists(tx, teamId);
      const adminIds = await this.adminIds(tx, teamId);
      const isAdmin = adminIds.includes(userId);
      if (isAdmin && adminIds.length === 1) {
        throw new LastAdminError(teamId, userId);
      }
      if (isAdmin) {
        await tx`
          UPDATE team_members SET is_admin = false
          WHERE team_id = ${teamId} AND user_id = ${userId}`;
        await this.touch(tx, teamId);
      }
      return this.require(tx, teamId);
    });
  }

  private async load(exec: Executor, id: string): Promise<Team | null> {
    const rows = await exec<TeamRow[]>`
      ${exec.unsafe(TEAM_SELECT)} WHERE t.id = ${id}`;
    return rows.length > 0 ? mapTeamRow(rows[0]) : null;
  }

  /** Loads a team that must exist (the mutation just wrote it). */
  private async require(exec: Executor, id: string): Promise<Team> {
    const team = await this.load(exec, id);
    if (!team) throw new Error(`Team ${id} not found.`);
    return team;
  }

  private async assertTeamExists(
    exec: Executor,
    teamId: string,
  ): Promise<void> {
    const rows = await exec`SELECT 1 FROM teams WHERE id = ${teamId}`;
    if (rows.length === 0) throw new Error(`Team ${teamId} not found.`);
  }

  private async adminIds(exec: Executor, teamId: string): Promise<string[]> {
    const rows = await exec<{ user_id: string }[]>`
      SELECT user_id FROM team_members
      WHERE team_id = ${teamId} AND is_admin`;
    return rows.map((r) => r.user_id);
  }

  private async touch(exec: Executor, teamId: string): Promise<void> {
    await exec`UPDATE teams SET updated_at = now() WHERE id = ${teamId}`;
  }
}
