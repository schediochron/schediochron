import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { SQL } from 'bun';
import type { Team } from '@schediochron/core';
import { createSqlClient } from './db.js';
import { migrateUp } from './migrate.js';
import {
  LastAdminError,
  TeamSqlRepository,
  mapTeamRow,
} from './team-repository.js';

// --- Pure logic: runs everywhere, no database ---------------------------------

describe('mapTeamRow', () => {
  it('assembles memberIds from all rows and adminIds from the admin rows', () => {
    const team = mapTeamRow({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Platform',
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-02T00:00:00.000Z'),
      members: [
        { userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', isAdmin: true },
        { userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', isAdmin: false },
        { userId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', isAdmin: true },
      ],
    });

    expect(team.memberIds).toEqual([
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    ]);
    expect(team.adminIds).toEqual([
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    ]);
  });

  it('keeps adminIds a subset of memberIds', () => {
    const team = mapTeamRow({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Platform',
      created_at: new Date(),
      updated_at: new Date(),
      members: [
        { userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', isAdmin: true },
        { userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', isAdmin: false },
      ],
    });
    const members = new Set(team.memberIds);
    expect(team.adminIds.every((id) => members.has(id))).toBe(true);
  });

  it('emits ISO 8601 UTC timestamps for Date and string inputs alike', () => {
    const fromDate = mapTeamRow({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'T',
      created_at: new Date('2026-03-04T05:06:07.000Z'),
      updated_at: '2026-03-04T05:06:08.000Z',
      members: [],
    });
    expect(fromDate.createdAt).toBe('2026-03-04T05:06:07.000Z');
    expect(fromDate.updatedAt).toBe('2026-03-04T05:06:08.000Z');
  });
});

describe('LastAdminError', () => {
  it('carries the team and user it refused to leave unadministered', () => {
    const err = new LastAdminError('team-1', 'user-1');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('LastAdminError');
    expect(err.teamId).toBe('team-1');
    expect(err.userId).toBe('user-1');
  });
});

// --- Database-backed: skipped without a live PostgreSQL (no Docker here) -------

describe.skipIf(!process.env.DATABASE_URL)(
  'TeamSqlRepository (postgres)',
  () => {
    let sql: SQL;
    let repo: TeamSqlRepository;

    // Four users the tests draw members from; team_members.user_id is a FK to users.
    const [alice, bob, carol, dave] = [
      crypto.randomUUID(),
      crypto.randomUUID(),
      crypto.randomUUID(),
      crypto.randomUUID(),
    ];
    const userIds = [alice, bob, carol, dave];
    const createdTeamIds: string[] = [];

    const isoNow = () => new Date().toISOString();

    function newTeam(overrides: Partial<Team> = {}): Team {
      const id = crypto.randomUUID();
      createdTeamIds.push(id);
      return {
        id,
        name: 'Team',
        adminIds: [alice],
        memberIds: [alice],
        createdAt: isoNow(),
        updatedAt: isoNow(),
        ...overrides,
      };
    }

    beforeAll(async () => {
      sql = createSqlClient();
      await migrateUp(sql);
      for (const id of userIds) {
        await sql`
        INSERT INTO users (id, username, role)
        VALUES (${id}, ${'u' + id.slice(0, 8)}, 'member')
        ON CONFLICT (id) DO NOTHING`;
      }
      repo = new TeamSqlRepository(sql);
    });

    afterAll(async () => {
      for (const id of createdTeamIds) {
        await sql`DELETE FROM teams WHERE id = ${id}`;
      }
      for (const id of userIds) {
        await sql`DELETE FROM users WHERE id = ${id}`;
      }
      await sql.close();
    });

    it('round-trips create → findById, assembling admins and members', async () => {
      const team = newTeam({
        name: '  Platform  ',
        adminIds: [alice],
        memberIds: [alice, bob],
      });
      const created = await repo.create(team);
      expect(created.name).toBe('Platform'); // trimmed by teamSchema
      expect(new Set(created.memberIds)).toEqual(new Set([alice, bob]));
      expect(created.adminIds).toEqual([alice]);
      expect(created.createdAt).toMatch(/Z$/);

      const found = await repo.findById(team.id);
      expect(found).not.toBeNull();
      expect(new Set(found?.memberIds)).toEqual(new Set([alice, bob]));
      expect(found?.adminIds).toEqual([alice]);
    });

    it('findById returns null for an unknown id', async () => {
      expect(await repo.findById(crypto.randomUUID())).toBeNull();
    });

    it('findByUserId returns every team the user participates in', async () => {
      const t1 = await repo.create(
        newTeam({ adminIds: [carol], memberIds: [carol] }),
      );
      const t2 = await repo.create(
        newTeam({ adminIds: [dave], memberIds: [dave, carol] }),
      );
      const teams = await repo.findByUserId(carol);
      const ids = teams.map((t) => t.id);
      expect(ids).toContain(t1.id);
      expect(ids).toContain(t2.id);
    });

    it('addMember adds a plain member and is idempotent', async () => {
      const team = await repo.create(
        newTeam({ adminIds: [alice], memberIds: [alice] }),
      );
      const after = await repo.addMember(team.id, bob);
      expect(new Set(after.memberIds)).toEqual(new Set([alice, bob]));
      expect(after.adminIds).toEqual([alice]);

      const again = await repo.addMember(team.id, bob); // no-op
      expect(new Set(again.memberIds)).toEqual(new Set([alice, bob]));
    });

    it('assignAdmin promotes an existing member and admits an absent one', async () => {
      const team = await repo.create(
        newTeam({ adminIds: [alice], memberIds: [alice, bob] }),
      );
      const promoted = await repo.assignAdmin(team.id, bob);
      expect(new Set(promoted.adminIds)).toEqual(new Set([alice, bob]));

      const admittedAndPromoted = await repo.assignAdmin(team.id, carol);
      expect(new Set(admittedAndPromoted.memberIds)).toEqual(
        new Set([alice, bob, carol]),
      );
      expect(new Set(admittedAndPromoted.adminIds)).toEqual(
        new Set([alice, bob, carol]),
      );
    });

    it('removeAdmin demotes an admin but leaves them a member', async () => {
      const team = await repo.create(
        newTeam({ adminIds: [alice, bob], memberIds: [alice, bob] }),
      );
      const after = await repo.removeAdmin(team.id, bob);
      expect(after.adminIds).toEqual([alice]);
      expect(new Set(after.memberIds)).toEqual(new Set([alice, bob]));
    });

    it('removeMember drops a user from both arrays', async () => {
      const team = await repo.create(
        newTeam({ adminIds: [alice, bob], memberIds: [alice, bob] }),
      );
      const after = await repo.removeMember(team.id, bob);
      expect(after.memberIds).toEqual([alice]);
      expect(after.adminIds).toEqual([alice]);
    });

    it('rejects removeAdmin of the last admin', async () => {
      const team = await repo.create(
        newTeam({ adminIds: [alice], memberIds: [alice] }),
      );
      await expect(repo.removeAdmin(team.id, alice)).rejects.toBeInstanceOf(
        LastAdminError,
      );
      // Unchanged: still an admin.
      const still = await repo.findById(team.id);
      expect(still?.adminIds).toEqual([alice]);
    });

    it('rejects removeMember that would remove the last admin', async () => {
      const team = await repo.create(
        newTeam({ adminIds: [alice], memberIds: [alice, bob] }),
      );
      await expect(repo.removeMember(team.id, alice)).rejects.toBeInstanceOf(
        LastAdminError,
      );
      const still = await repo.findById(team.id);
      expect(new Set(still?.memberIds)).toEqual(new Set([alice, bob]));
    });

    it('update replaces name and membership atomically', async () => {
      const team = await repo.create(
        newTeam({ name: 'Old', adminIds: [alice], memberIds: [alice] }),
      );
      const next: Team = {
        ...team,
        name: 'New',
        adminIds: [alice, bob],
        memberIds: [alice, bob, carol],
      };
      const updated = await repo.update(next);
      expect(updated.name).toBe('New');
      expect(new Set(updated.adminIds)).toEqual(new Set([alice, bob]));
      expect(new Set(updated.memberIds)).toEqual(new Set([alice, bob, carol]));
    });

    it('delete removes the team and its membership', async () => {
      const team = await repo.create(newTeam());
      await repo.delete(team.id);
      expect(await repo.findById(team.id)).toBeNull();
      await repo.delete(team.id); // no-op on unknown id
    });
  },
);
