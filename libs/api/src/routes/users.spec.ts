import { describe, expect, it } from 'bun:test';
import { validateUser } from '@schediochron/core';
import { app } from '../app.js';

const id = '99999999-9999-4999-8999-999999999999';

describe('GET /users', () => {
  it('returns an array of valid users', async () => {
    const res = await app.request('/users');
    const body = (await res.json()) as unknown[];

    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    for (const user of body) {
      expect(validateUser(user).success).toBe(true);
    }
  });
});

describe('GET /users/:id', () => {
  it('returns a valid user carrying the requested id', async () => {
    const res = await app.request(`/users/${id}`);
    const body = (await res.json()) as { id: string };

    expect(validateUser(body).success).toBe(true);
    expect(body.id).toBe(id);
  });
});

describe('PATCH /users/:id', () => {
  it('returns a valid user carrying the requested id', async () => {
    const res = await app.request(`/users/${id}`, { method: 'PATCH' });
    const body = (await res.json()) as { id: string };

    expect(validateUser(body).success).toBe(true);
    expect(body.id).toBe(id);
  });
});
