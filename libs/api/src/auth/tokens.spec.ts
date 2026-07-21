import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  InvalidAccessTokenError,
  getAccessTokenSecret,
  getAccessTokenTtlSeconds,
  signAccessToken,
  verifyAccessToken,
} from './tokens.js';

const SECRET = 'test-signing-secret';
const subject = { id: 'user-1', username: 'ada', role: 'admin' as const };

let savedSecret: string | undefined;
let savedTtl: string | undefined;

beforeEach(() => {
  savedSecret = process.env.ACCESS_TOKEN_SECRET;
  savedTtl = process.env.ACCESS_TOKEN_TTL_SECONDS;
});

afterEach(() => {
  if (savedSecret === undefined) delete process.env.ACCESS_TOKEN_SECRET;
  else process.env.ACCESS_TOKEN_SECRET = savedSecret;
  if (savedTtl === undefined) delete process.env.ACCESS_TOKEN_TTL_SECONDS;
  else process.env.ACCESS_TOKEN_TTL_SECONDS = savedTtl;
});

describe('signAccessToken / verifyAccessToken', () => {
  it('round-trips the subject as typed claims', async () => {
    const token = await signAccessToken(subject, { secret: SECRET });
    const claims = await verifyAccessToken(token, SECRET);
    expect(claims.sub).toBe('user-1');
    expect(claims.username).toBe('ada');
    expect(claims.role).toBe('admin');
    expect(claims.exp).toBeGreaterThan(claims.iat);
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await signAccessToken(subject, { secret: SECRET });
    await expect(
      verifyAccessToken(token, 'other-secret'),
    ).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });

  it('rejects a malformed token', async () => {
    await expect(verifyAccessToken('not.a.jwt', SECRET)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  it('rejects an expired token', async () => {
    const past = Math.floor(Date.now() / 1000) - 3600;
    const token = await signAccessToken(subject, {
      secret: SECRET,
      ttlSeconds: 60,
      now: past,
    });
    await expect(verifyAccessToken(token, SECRET)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  it('rejects a well-signed token that lacks the required claims', async () => {
    // A JWT signed with the right secret but without our claims must still fail.
    const { sign } = await import('hono/jwt');
    const token = await sign({ foo: 'bar' }, SECRET);
    await expect(verifyAccessToken(token, SECRET)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });
});

describe('getAccessTokenSecret', () => {
  it('returns the configured secret', () => {
    process.env.ACCESS_TOKEN_SECRET = SECRET;
    expect(getAccessTokenSecret()).toBe(SECRET);
  });

  it('throws when the secret is unset', () => {
    delete process.env.ACCESS_TOKEN_SECRET;
    expect(() => getAccessTokenSecret()).toThrow(
      /ACCESS_TOKEN_SECRET is not set/,
    );
  });

  it('throws when the secret is empty', () => {
    process.env.ACCESS_TOKEN_SECRET = '';
    expect(() => getAccessTokenSecret()).toThrow(
      /ACCESS_TOKEN_SECRET is not set/,
    );
  });
});

describe('getAccessTokenTtlSeconds', () => {
  it('defaults to 15 minutes when unset', () => {
    delete process.env.ACCESS_TOKEN_TTL_SECONDS;
    expect(getAccessTokenTtlSeconds()).toBe(900);
  });

  it('reads a positive integer from the environment', () => {
    process.env.ACCESS_TOKEN_TTL_SECONDS = '300';
    expect(getAccessTokenTtlSeconds()).toBe(300);
  });

  it('rejects a non-positive or non-integer value', () => {
    process.env.ACCESS_TOKEN_TTL_SECONDS = '0';
    expect(() => getAccessTokenTtlSeconds()).toThrow(/positive integer/);
    process.env.ACCESS_TOKEN_TTL_SECONDS = 'abc';
    expect(() => getAccessTokenTtlSeconds()).toThrow(/positive integer/);
  });
});
