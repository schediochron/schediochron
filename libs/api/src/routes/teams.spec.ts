import { describe, expect, it } from 'bun:test';
import { validateTeam } from '@schediochron/core';
import { app } from '../app.js';

const id = '77777777-7777-4777-8777-777777777777';

describe('GET /teams', () => {
  it('returns an array of valid teams', async () => {
    const res = await app.request('/teams');
    const body = (await res.json()) as unknown[];

    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    for (const team of body) {
      expect(validateTeam(team).success).toBe(true);
    }
  });
});

describe('POST /teams', () => {
  it('returns a valid team', async () => {
    const res = await app.request('/teams', { method: 'POST' });

    expect(validateTeam(await res.json()).success).toBe(true);
  });
});

describe('GET /teams/:id', () => {
  it('returns a valid team carrying the requested id', async () => {
    const res = await app.request(`/teams/${id}`);
    const body = (await res.json()) as { id: string };

    expect(validateTeam(body).success).toBe(true);
    expect(body.id).toBe(id);
  });
});

describe('PATCH /teams/:id', () => {
  it('returns a valid team carrying the requested id', async () => {
    const res = await app.request(`/teams/${id}`, { method: 'PATCH' });
    const body = (await res.json()) as { id: string };

    expect(validateTeam(body).success).toBe(true);
    expect(body.id).toBe(id);
  });
});

describe('POST /teams/:id/members', () => {
  it('returns the updated team', async () => {
    const res = await app.request(`/teams/${id}/members`, { method: 'POST' });
    const body = (await res.json()) as { id: string };

    expect(validateTeam(body).success).toBe(true);
    expect(body.id).toBe(id);
  });
});

describe('DELETE /teams/:id/members/:userId', () => {
  it('returns the updated team', async () => {
    const res = await app.request(`/teams/${id}/members/u-2`, {
      method: 'DELETE',
    });
    const body = (await res.json()) as { id: string };

    expect(validateTeam(body).success).toBe(true);
    expect(body.id).toBe(id);
  });
});
