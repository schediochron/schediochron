import { describe, expect, it } from 'bun:test';
import { validateUser } from '@schediochron/core';
import { app } from '../app.js';

describe('POST /auth/register', () => {
  it('returns a valid user and a token pair', async () => {
    const res = await app.request('/auth/register', { method: 'POST' });
    const body = (await res.json()) as Record<string, unknown>;

    expect(validateUser(body['user']).success).toBe(true);
    expect(typeof body['accessToken']).toBe('string');
    expect(typeof body['refreshToken']).toBe('string');
  });
});

describe('POST /auth/login', () => {
  it('returns a valid user and a token pair', async () => {
    const res = await app.request('/auth/login', { method: 'POST' });
    const body = (await res.json()) as Record<string, unknown>;

    expect(validateUser(body['user']).success).toBe(true);
    expect(typeof body['accessToken']).toBe('string');
    expect(typeof body['refreshToken']).toBe('string');
  });
});

describe('POST /auth/refresh', () => {
  it('returns a token pair without a user', async () => {
    const res = await app.request('/auth/refresh', { method: 'POST' });
    const body = (await res.json()) as Record<string, unknown>;

    expect(typeof body['accessToken']).toBe('string');
    expect(typeof body['refreshToken']).toBe('string');
    expect(body['user']).toBeUndefined();
  });
});
