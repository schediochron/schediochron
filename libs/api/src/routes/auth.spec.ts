import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type {
  RefreshToken,
  RefreshTokenRepository,
  User,
  UserRepository,
} from '@schediochron/core';
import { validateUser } from '@schediochron/core';
import {
  DuplicateUserError,
  type PasswordCredentialStore,
} from '@schediochron/sql';
import { app } from '../app.js';
import { setRepositories, type Repositories } from '../repositories.js';
import { hashRefreshToken } from '../auth/refresh-tokens.js';

// Real signing and real Bun.password are used; only persistence is faked.
process.env.ACCESS_TOKEN_SECRET = 'test-secret-for-auth-endpoints';

// --- In-memory fakes -------------------------------------------------------

class FakeUserRepository implements UserRepository {
  private readonly byId = new Map<string, User>();

  async findById(id: string): Promise<User | null> {
    return this.byId.get(id) ?? null;
  }

  async findByUsername(username: string): Promise<User | null> {
    for (const user of this.byId.values()) {
      if (user.username === username) return user;
    }
    return null;
  }

  async findAll(): Promise<User[]> {
    return [...this.byId.values()];
  }

  async create(item: User): Promise<User> {
    for (const user of this.byId.values()) {
      if (user.username === item.username) {
        throw new DuplicateUserError('username');
      }
      if (item.email !== null && user.email === item.email) {
        throw new DuplicateUserError('email');
      }
    }
    const now = new Date().toISOString();
    const stored: User = { ...item, createdAt: now, updatedAt: now };
    this.byId.set(stored.id, stored);
    return stored;
  }

  async update(item: User): Promise<User> {
    this.byId.set(item.id, item);
    return item;
  }

  async delete(id: string): Promise<void> {
    this.byId.delete(id);
  }
}

class FakeCredentialStore implements PasswordCredentialStore {
  private readonly byUser = new Map<string, string>();

  async set(userId: string, passwordHash: string): Promise<void> {
    this.byUser.set(userId, passwordHash);
  }

  async findPasswordHash(userId: string): Promise<string | null> {
    return this.byUser.get(userId) ?? null;
  }
}

class FakeRefreshTokenRepository implements RefreshTokenRepository {
  private readonly byToken = new Map<string, RefreshToken>();

  async create(token: RefreshToken): Promise<RefreshToken> {
    this.byToken.set(token.token, token);
    return token;
  }

  async findByToken(token: string): Promise<RefreshToken | null> {
    return this.byToken.get(token) ?? null;
  }

  async revoke(token: string): Promise<void> {
    const found = this.byToken.get(token);
    if (found && found.revokedAt === null) {
      this.byToken.set(token, {
        ...found,
        revokedAt: new Date().toISOString(),
      });
    }
  }

  async revokeAllForUser(userId: string): Promise<void> {
    for (const [key, token] of this.byToken) {
      if (token.userId === userId && token.revokedAt === null) {
        this.byToken.set(key, {
          ...token,
          revokedAt: new Date().toISOString(),
        });
      }
    }
  }

  /** Test-only: insert a record verbatim (e.g. an already-expired token). */
  seed(token: RefreshToken): void {
    this.byToken.set(token.token, token);
  }
}

let refreshTokens: FakeRefreshTokenRepository;

function installFakes(): void {
  refreshTokens = new FakeRefreshTokenRepository();
  const repos: Repositories = {
    users: new FakeUserRepository(),
    credentials: new FakeCredentialStore(),
    refreshTokens,
    // Unused by the auth routes.
    teams: undefined as unknown as Repositories['teams'],
    timeEntries: undefined as unknown as Repositories['timeEntries'],
  };
  setRepositories(repos);
}

const jsonRequest = (
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) =>
  app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

async function register(
  username = 'ada_lovelace',
  password = 'correct horse',
): Promise<{ accessToken: string; refreshToken: string; user: User }> {
  const res = await jsonRequest('/auth/register', { username, password });
  return (await res.json()) as {
    accessToken: string;
    refreshToken: string;
    user: User;
  };
}

// --- Tests -----------------------------------------------------------------

beforeEach(() => {
  installFakes();
});

afterEach(() => {
  setRepositories(undefined);
});

describe('POST /auth/register', () => {
  it('creates a user, returns 201 with a token pair and no passwordHash', async () => {
    const res = await jsonRequest('/auth/register', {
      username: 'ada_lovelace',
      password: 'correct horse',
      displayName: 'Ada',
    });
    expect(res.status).toBe(201);

    const body = (await res.json()) as Record<string, unknown>;
    expect(validateUser(body['user']).success).toBe(true);
    expect(
      (body['user'] as Record<string, unknown>)['passwordHash'],
    ).toBeUndefined();
    expect(typeof body['accessToken']).toBe('string');
    expect(typeof body['refreshToken']).toBe('string');
  });

  it('returns 400 on a validation failure (short password)', async () => {
    const res = await jsonRequest('/auth/register', {
      username: 'ada_lovelace',
      password: 'short',
    });
    expect(res.status).toBe(400);
  });

  it('returns 409 on a duplicate username', async () => {
    await register('ada_lovelace');
    const res = await jsonRequest('/auth/register', {
      username: 'ada_lovelace',
      password: 'another password',
    });
    expect(res.status).toBe(409);
  });

  it('returns 409 on a duplicate email', async () => {
    await jsonRequest('/auth/register', {
      username: 'ada_lovelace',
      password: 'correct horse',
      email: 'ada@example.com',
    });
    const res = await jsonRequest('/auth/register', {
      username: 'grace_hopper',
      password: 'correct horse',
      email: 'ada@example.com',
    });
    expect(res.status).toBe(409);
  });
});

describe('POST /auth/login', () => {
  it('authenticates by username and returns 200 with a token pair', async () => {
    await register('ada_lovelace', 'correct horse');
    const res = await jsonRequest('/auth/login', {
      username: 'ada_lovelace',
      password: 'correct horse',
    });
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;
    expect(validateUser(body['user']).success).toBe(true);
    expect(typeof body['accessToken']).toBe('string');
    expect(typeof body['refreshToken']).toBe('string');
  });

  it('returns 401 on a wrong password', async () => {
    await register('ada_lovelace', 'correct horse');
    const res = await jsonRequest('/auth/login', {
      username: 'ada_lovelace',
      password: 'wrong password',
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 for an unknown user', async () => {
    const res = await jsonRequest('/auth/login', {
      username: 'nobody',
      password: 'correct horse',
    });
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/refresh', () => {
  it('exchanges a valid refresh token for a new token pair (200)', async () => {
    const { refreshToken } = await register();
    const res = await jsonRequest('/auth/refresh', { refreshToken });
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;
    expect(typeof body['accessToken']).toBe('string');
    expect(typeof body['refreshToken']).toBe('string');
    expect(body['user']).toBeUndefined();
    // Rotation: the returned token differs from the presented one.
    expect(body['refreshToken']).not.toBe(refreshToken);
  });

  it('returns 401 when the same token is reused after rotation', async () => {
    const { refreshToken } = await register();
    await jsonRequest('/auth/refresh', { refreshToken });
    const res = await jsonRequest('/auth/refresh', { refreshToken });
    expect(res.status).toBe(401);
  });

  it('returns 401 for an expired refresh token', async () => {
    const { refreshToken, user } = await register();
    // Force the stored record to be expired.
    refreshTokens.seed({
      token: hashRefreshToken(refreshToken),
      userId: user.id,
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      revokedAt: null,
    });
    const res = await jsonRequest('/auth/refresh', { refreshToken });
    expect(res.status).toBe(401);
  });

  it('returns 401 for an unknown refresh token', async () => {
    const res = await jsonRequest('/auth/refresh', {
      refreshToken: 'never-issued',
    });
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('requires authentication (401 without a bearer token)', async () => {
    const { refreshToken } = await register();
    const res = await jsonRequest('/auth/logout', { refreshToken });
    expect(res.status).toBe(401);
  });

  it('revokes the refresh token: logout then refresh returns 401', async () => {
    const { accessToken, refreshToken } = await register();

    const logout = await jsonRequest(
      '/auth/logout',
      { refreshToken },
      { Authorization: `Bearer ${accessToken}` },
    );
    expect(logout.status).toBe(204);

    const refresh = await jsonRequest('/auth/refresh', { refreshToken });
    expect(refresh.status).toBe(401);
  });

  it('is idempotent — logging out an unknown token still returns 204', async () => {
    const { accessToken } = await register();
    const res = await jsonRequest(
      '/auth/logout',
      { refreshToken: 'never-issued' },
      { Authorization: `Bearer ${accessToken}` },
    );
    expect(res.status).toBe(204);
  });
});
