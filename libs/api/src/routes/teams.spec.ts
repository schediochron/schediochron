import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { Team, TeamRepository } from '@schediochron/core';
import { validateTeam } from '@schediochron/core';
import { LastAdminError } from '@schediochron/sql';
import { app } from '../app.js';
import { signAccessToken } from '../auth/tokens.js';
import { setRepositories, type Repositories } from '../repositories.js';

/**
 * Team-endpoint tests. No PostgreSQL here: an in-memory {@link FakeTeamRepository}
 * is injected via `setRepositories`, so validation, authentication, the per-team
 * admin authorisation (403), read scoping, and the repository's `LastAdminError`
 * → 409 mapping are all exercised against real HTTP requests without a database.
 */

process.env['ACCESS_TOKEN_SECRET'] = 'test-secret-for-team-endpoints';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const MEMBER_ID = '22222222-2222-4222-8222-222222222222';
const OUTSIDER_ID = '33333333-3333-4333-8333-333333333333';
const NEWCOMER_ID = '44444444-4444-4444-8444-444444444444';
const TEAM_ID = '55555555-5555-4555-8555-555555555555';
const SOLO_TEAM_ID = '66666666-6666-4666-8666-666666666666';
const MISSING_TEAM_ID = '99999999-9999-4999-8999-999999999999';

const clone = (team: Team): Team => ({
  ...team,
  adminIds: [...team.adminIds],
  memberIds: [...team.memberIds],
});

/** In-memory {@link TeamRepository} mirroring the SQL repo's mutation semantics. */
class FakeTeamRepository implements TeamRepository {
  private readonly teams = new Map<string, Team>();

  seed(team: Team): void {
    this.teams.set(team.id, clone(team));
  }

  private require(teamId: string): Team {
    const team = this.teams.get(teamId);
    if (!team) throw new Error(`Team ${teamId} not found.`);
    return team;
  }

  async findById(id: string): Promise<Team | null> {
    const team = this.teams.get(id);
    return team ? clone(team) : null;
  }

  async findAll(): Promise<Team[]> {
    return [...this.teams.values()].map(clone);
  }

  async findByUserId(userId: string): Promise<Team[]> {
    return [...this.teams.values()]
      .filter((team) => team.memberIds.includes(userId))
      .map(clone);
  }

  async create(team: Team): Promise<Team> {
    this.teams.set(team.id, clone(team));
    return clone(team);
  }

  async update(team: Team): Promise<Team> {
    this.require(team.id);
    const next = { ...clone(team), updatedAt: new Date().toISOString() };
    this.teams.set(team.id, next);
    return clone(next);
  }

  async delete(id: string): Promise<void> {
    this.teams.delete(id);
  }

  async addMember(teamId: string, userId: string): Promise<Team> {
    const team = this.require(teamId);
    if (!team.memberIds.includes(userId)) team.memberIds.push(userId);
    return clone(team);
  }

  async removeMember(teamId: string, userId: string): Promise<Team> {
    const team = this.require(teamId);
    if (team.adminIds.includes(userId) && team.adminIds.length === 1) {
      throw new LastAdminError(teamId, userId);
    }
    team.memberIds = team.memberIds.filter((id) => id !== userId);
    team.adminIds = team.adminIds.filter((id) => id !== userId);
    return clone(team);
  }

  async assignAdmin(teamId: string, userId: string): Promise<Team> {
    const team = this.require(teamId);
    if (!team.memberIds.includes(userId)) team.memberIds.push(userId);
    if (!team.adminIds.includes(userId)) team.adminIds.push(userId);
    return clone(team);
  }

  async removeAdmin(teamId: string, userId: string): Promise<Team> {
    const team = this.require(teamId);
    if (team.adminIds.includes(userId) && team.adminIds.length === 1) {
      throw new LastAdminError(teamId, userId);
    }
    team.adminIds = team.adminIds.filter((id) => id !== userId);
    return clone(team);
  }
}

const teamFixture = (): Team => ({
  id: TEAM_ID,
  name: 'Engineering',
  adminIds: [ADMIN_ID],
  memberIds: [ADMIN_ID, MEMBER_ID],
  createdAt: '2026-01-05T08:00:00Z',
  updatedAt: '2026-01-05T08:00:00Z',
});

const soloTeamFixture = (): Team => ({
  id: SOLO_TEAM_ID,
  name: 'Solo',
  adminIds: [ADMIN_ID],
  memberIds: [ADMIN_ID],
  createdAt: '2026-01-05T08:00:00Z',
  updatedAt: '2026-01-05T08:00:00Z',
});

let repo: FakeTeamRepository;

beforeEach(() => {
  repo = new FakeTeamRepository();
  repo.seed(teamFixture());
  repo.seed(soloTeamFixture());
  setRepositories({ teams: repo } as unknown as Repositories);
});

afterEach(() => {
  setRepositories(undefined);
});

const tokenFor = (id: string) =>
  signAccessToken({ id, username: `user-${id.slice(0, 4)}`, role: 'member' });

const authed = (token: string, init: RequestInit = {}): RequestInit => ({
  ...init,
  headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
});

const jsonBody = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

describe('GET /teams', () => {
  it('401s without a token', async () => {
    const res = await app.request('/teams');
    expect(res.status).toBe(401);
  });

  it('returns only the teams the caller is a member of', async () => {
    const res = await app.request('/teams', authed(await tokenFor(MEMBER_ID)));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Team[];
    expect(body.map((t) => t.id)).toEqual([TEAM_ID]);
    expect(body.every((t) => validateTeam(t).success)).toBe(true);
  });

  it('returns an empty list for a user in no teams', async () => {
    const res = await app.request(
      '/teams',
      authed(await tokenFor(OUTSIDER_ID)),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});

describe('POST /teams', () => {
  it('401s without a token', async () => {
    const res = await app.request('/teams', jsonBody({ name: 'New' }));
    expect(res.status).toBe(401);
  });

  it('400s on an invalid body', async () => {
    const res = await app.request(
      '/teams',
      authed(await tokenFor(OUTSIDER_ID), jsonBody({ name: '' })),
    );
    expect(res.status).toBe(400);
  });

  it('creates a team with the caller as sole admin and member', async () => {
    const res = await app.request(
      '/teams',
      authed(await tokenFor(OUTSIDER_ID), jsonBody({ name: 'Design' })),
    );
    expect(res.status).toBe(201);
    const team = (await res.json()) as Team;
    expect(validateTeam(team).success).toBe(true);
    expect(team.name).toBe('Design');
    expect(team.adminIds).toEqual([OUTSIDER_ID]);
    expect(team.memberIds).toEqual([OUTSIDER_ID]);
  });
});

describe('GET /teams/:id', () => {
  it('returns the team for a member', async () => {
    const res = await app.request(
      `/teams/${TEAM_ID}`,
      authed(await tokenFor(MEMBER_ID)),
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as Team).id).toBe(TEAM_ID);
  });

  it('404s for a non-member (membership is not probeable)', async () => {
    const res = await app.request(
      `/teams/${TEAM_ID}`,
      authed(await tokenFor(OUTSIDER_ID)),
    );
    expect(res.status).toBe(404);
  });

  it('404s for a missing team', async () => {
    const res = await app.request(
      `/teams/${MISSING_TEAM_ID}`,
      authed(await tokenFor(ADMIN_ID)),
    );
    expect(res.status).toBe(404);
  });
});

describe('PATCH /teams/:id', () => {
  const patch = (body: unknown): RequestInit => ({
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  it('renames the team for an admin', async () => {
    const res = await app.request(
      `/teams/${TEAM_ID}`,
      authed(await tokenFor(ADMIN_ID), patch({ name: 'Platform' })),
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as Team).name).toBe('Platform');
  });

  it('403s for a non-admin member', async () => {
    const res = await app.request(
      `/teams/${TEAM_ID}`,
      authed(await tokenFor(MEMBER_ID), patch({ name: 'Platform' })),
    );
    expect(res.status).toBe(403);
  });

  it('400s on an invalid body for an admin', async () => {
    const res = await app.request(
      `/teams/${TEAM_ID}`,
      authed(await tokenFor(ADMIN_ID), patch({ name: '' })),
    );
    expect(res.status).toBe(400);
  });

  it('404s for a missing team', async () => {
    const res = await app.request(
      `/teams/${MISSING_TEAM_ID}`,
      authed(await tokenFor(ADMIN_ID), patch({ name: 'Platform' })),
    );
    expect(res.status).toBe(404);
  });
});

describe('DELETE /teams/:id', () => {
  const del = (token: string): RequestInit =>
    authed(token, { method: 'DELETE' });

  it('deletes a team the admin is the only member of', async () => {
    const res = await app.request(
      `/teams/${SOLO_TEAM_ID}`,
      del(await tokenFor(ADMIN_ID)),
    );
    expect(res.status).toBe(204);
  });

  it('409s when the team still has other members', async () => {
    const res = await app.request(
      `/teams/${TEAM_ID}`,
      del(await tokenFor(ADMIN_ID)),
    );
    expect(res.status).toBe(409);
  });

  it('403s for a non-admin member', async () => {
    const res = await app.request(
      `/teams/${SOLO_TEAM_ID}`,
      del(await tokenFor(MEMBER_ID)),
    );
    expect(res.status).toBe(403);
  });

  it('404s for a missing team', async () => {
    const res = await app.request(
      `/teams/${MISSING_TEAM_ID}`,
      del(await tokenFor(ADMIN_ID)),
    );
    expect(res.status).toBe(404);
  });
});

describe('POST /teams/:id/members', () => {
  it('adds a member for an admin and returns the updated team', async () => {
    const res = await app.request(
      `/teams/${TEAM_ID}/members`,
      authed(await tokenFor(ADMIN_ID), jsonBody({ userId: NEWCOMER_ID })),
    );
    expect(res.status).toBe(200);
    const team = (await res.json()) as Team;
    expect(validateTeam(team).success).toBe(true);
    expect(team.memberIds).toContain(NEWCOMER_ID);
  });

  it('403s for a non-admin member', async () => {
    const res = await app.request(
      `/teams/${TEAM_ID}/members`,
      authed(await tokenFor(MEMBER_ID), jsonBody({ userId: NEWCOMER_ID })),
    );
    expect(res.status).toBe(403);
  });

  it('409s when the user is already a member', async () => {
    const res = await app.request(
      `/teams/${TEAM_ID}/members`,
      authed(await tokenFor(ADMIN_ID), jsonBody({ userId: MEMBER_ID })),
    );
    expect(res.status).toBe(409);
  });

  it('400s on an invalid body', async () => {
    const res = await app.request(
      `/teams/${TEAM_ID}/members`,
      authed(await tokenFor(ADMIN_ID), jsonBody({ userId: 'not-a-uuid' })),
    );
    expect(res.status).toBe(400);
  });

  it('404s for a missing team', async () => {
    const res = await app.request(
      `/teams/${MISSING_TEAM_ID}/members`,
      authed(await tokenFor(ADMIN_ID), jsonBody({ userId: NEWCOMER_ID })),
    );
    expect(res.status).toBe(404);
  });
});

describe('DELETE /teams/:id/members/:userId', () => {
  const del = (token: string): RequestInit =>
    authed(token, { method: 'DELETE' });

  it('removes a member for an admin and returns the updated team', async () => {
    const res = await app.request(
      `/teams/${TEAM_ID}/members/${MEMBER_ID}`,
      del(await tokenFor(ADMIN_ID)),
    );
    expect(res.status).toBe(200);
    const team = (await res.json()) as Team;
    expect(team.memberIds).not.toContain(MEMBER_ID);
  });

  it('409s when removing the last admin (LastAdminError)', async () => {
    const res = await app.request(
      `/teams/${TEAM_ID}/members/${ADMIN_ID}`,
      del(await tokenFor(ADMIN_ID)),
    );
    expect(res.status).toBe(409);
  });

  it('403s for a non-admin member', async () => {
    const res = await app.request(
      `/teams/${TEAM_ID}/members/${MEMBER_ID}`,
      del(await tokenFor(MEMBER_ID)),
    );
    expect(res.status).toBe(403);
  });

  it('404s for a missing team', async () => {
    const res = await app.request(
      `/teams/${MISSING_TEAM_ID}/members/${MEMBER_ID}`,
      del(await tokenFor(ADMIN_ID)),
    );
    expect(res.status).toBe(404);
  });
});
