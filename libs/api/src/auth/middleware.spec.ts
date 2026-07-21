import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { Team } from '@schediochron/core';
import { createRouter } from '../http.js';
import {
  getAuthenticatedUser,
  isTeamAdmin,
  requireAuth,
  requireSystemRole,
} from './middleware.js';
import { signAccessToken } from './tokens.js';

const SECRET = 'middleware-test-secret';

// requireAuth verifies with the env secret, so the tokens the tests sign must
// use the same one. Pin it for this file and restore afterwards.
let savedSecret: string | undefined;
beforeAll(() => {
  savedSecret = process.env.ACCESS_TOKEN_SECRET;
  process.env.ACCESS_TOKEN_SECRET = SECRET;
});
afterAll(() => {
  if (savedSecret === undefined) delete process.env.ACCESS_TOKEN_SECRET;
  else process.env.ACCESS_TOKEN_SECRET = savedSecret;
});

/** A router that echoes the authenticated user from behind requireAuth. */
function protectedApp() {
  const app = createRouter();
  app.use('/me', requireAuth);
  app.get('/me', (c) => c.json(getAuthenticatedUser(c)));
  return app;
}

/** A router requiring a system admin behind requireAuth. */
function adminApp() {
  const app = createRouter();
  app.use('/admin', requireAuth, requireSystemRole('admin'));
  app.get('/admin', (c) => c.json({ ok: true }));
  return app;
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('requireAuth', () => {
  const app = protectedApp();

  it('401s with the error envelope when the header is absent', async () => {
    const res = await app.request('/me');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: 'Missing or malformed Authorization header',
    });
  });

  it('401s when the header is not a Bearer token', async () => {
    const res = await app.request('/me', {
      headers: { Authorization: 'Token abc' },
    });
    expect(res.status).toBe(401);
  });

  it('401s on a malformed token', async () => {
    const res = await app.request('/me', { headers: bearer('not.a.jwt') });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: 'Invalid or expired access token',
    });
  });

  it('401s on an expired token', async () => {
    const past = Math.floor(Date.now() / 1000) - 3600;
    const token = await signAccessToken(
      { id: 'u1', username: 'ada', role: 'member' },
      { secret: SECRET, ttlSeconds: 60, now: past },
    );
    const res = await app.request('/me', { headers: bearer(token) });
    expect(res.status).toBe(401);
  });

  it('attaches the typed identity on a valid token', async () => {
    const token = await signAccessToken(
      { id: 'u1', username: 'ada', role: 'member' },
      { secret: SECRET },
    );
    const res = await app.request('/me', { headers: bearer(token) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: 'u1',
      username: 'ada',
      role: 'member',
    });
  });
});

describe('requireSystemRole', () => {
  const app = adminApp();

  it('403s a valid token whose role is insufficient', async () => {
    const token = await signAccessToken(
      { id: 'u1', username: 'ada', role: 'member' },
      { secret: SECRET },
    );
    const res = await app.request('/admin', { headers: bearer(token) });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Insufficient role' });
  });

  it('allows a token with a sufficient role', async () => {
    const token = await signAccessToken(
      { id: 'u1', username: 'grace', role: 'admin' },
      { secret: SECRET },
    );
    const res = await app.request('/admin', { headers: bearer(token) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('401s before the role check when unauthenticated', async () => {
    const res = await app.request('/admin');
    expect(res.status).toBe(401);
  });
});

describe('isTeamAdmin', () => {
  const team: Team = {
    id: 'team-1',
    name: 'Engineering',
    adminIds: ['admin-1'],
    memberIds: ['admin-1', 'member-1'],
    createdAt: '2026-01-05T08:00:00Z',
    updatedAt: '2026-01-05T08:00:00Z',
  };

  it('is true for a team admin and false for a plain member', () => {
    expect(isTeamAdmin('admin-1', team)).toBe(true);
    expect(isTeamAdmin('member-1', team)).toBe(false);
  });

  it('is independent of the system role — a plain member can be a team admin', () => {
    // 'member-1' is a system member here yet not a team admin; 'admin-1' need
    // not be a system admin to administer this team. The axis is membership.
    expect(isTeamAdmin('someone-else', team)).toBe(false);
  });
});
