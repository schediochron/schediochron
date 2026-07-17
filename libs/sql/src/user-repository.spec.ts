import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import type { SQL } from 'bun';
import type { User } from '@schediochron/core';
import { createSqlClient } from './db.js';
import { migrateUp } from './migrate.js';
import { DuplicateUserError, UserRepository } from './user-repository.js';

// A well-formed User with sensible defaults; override per test.
function makeUser(overrides: Partial<User> = {}): User {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    username: `user_${randomUUID().slice(0, 8)}`,
    displayName: 'Ada Lovelace',
    email: `${randomUUID().slice(0, 8)}@example.com`,
    role: 'member',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// Pure, DB-free assertions on the shapes the repository exposes.
describe('DuplicateUserError', () => {
  it('names the offending field and carries the driver error as cause', () => {
    const cause = { code: '23505', constraint: 'users_email_key' };
    const err = new DuplicateUserError('email', { cause });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('DuplicateUserError');
    expect(err.field).toBe('email');
    expect(err.message).toContain('email');
    expect(err.cause).toBe(cause);
  });

  it('describes an unattributable violation without a column name', () => {
    const err = new DuplicateUserError('unknown');
    expect(err.field).toBe('unknown');
    expect(err.message).toContain('unique user field');
  });
});

// DB-backed round-trips. There is no live PostgreSQL in CI/dev here, so these
// skip unless DATABASE_URL points at a disposable database.
describe.skipIf(!process.env.DATABASE_URL)('UserRepository (PostgreSQL)', () => {
  let sql: SQL;
  let repo: UserRepository;

  beforeAll(async () => {
    sql = createSqlClient();
    await migrateUp(sql);
    repo = new UserRepository(sql);
  });

  afterAll(async () => {
    await sql?.close();
  });

  it('creates a user and reads it back by id and by username', async () => {
    const user = makeUser();
    const created = await repo.create(user);

    expect(created.id).toBe(user.id);
    expect(created.username).toBe(user.username);
    expect(created.displayName).toBe(user.displayName);
    expect(created.email).toBe(user.email);
    expect(created.role).toBe('member');
    // Timestamps are set by the persistence layer and are ISO 8601 UTC.
    expect(created.createdAt).toMatch(/Z$/);
    expect(created.updatedAt).toMatch(/Z$/);
    expect(new Date(created.createdAt).toISOString()).toBe(created.createdAt);

    expect(await repo.findById(user.id)).toEqual(created);
    expect(await repo.findByUsername(user.username)).toEqual(created);
  });

  it('returns null for an unknown id or username', async () => {
    expect(await repo.findById(randomUUID())).toBeNull();
    expect(await repo.findByUsername(`missing_${randomUUID().slice(0, 8)}`)).toBeNull();
  });

  it('maps null displayName and email to null (never empty string)', async () => {
    const user = makeUser({ displayName: null, email: null });
    const created = await repo.create(user);

    expect(created.displayName).toBeNull();
    expect(created.email).toBeNull();

    const fetched = await repo.findById(user.id);
    expect(fetched?.displayName).toBeNull();
    expect(fetched?.email).toBeNull();
  });

  it('update refreshes updatedAt and persists mutable fields', async () => {
    const created = await repo.create(makeUser({ role: 'member' }));
    // Ensure the clock advances so updatedAt is observably newer.
    await new Promise((resolve) => setTimeout(resolve, 5));

    const updated = await repo.update({
      ...created,
      displayName: 'Grace Hopper',
      email: null,
      role: 'admin',
    });

    expect(updated.displayName).toBe('Grace Hopper');
    expect(updated.email).toBeNull();
    expect(updated.role).toBe('admin');
    expect(updated.createdAt).toBe(created.createdAt);
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(
      new Date(created.updatedAt).getTime(),
    );
  });

  it('delete removes the row; deleting an unknown id is a no-op', async () => {
    const created = await repo.create(makeUser());
    await repo.delete(created.id);
    expect(await repo.findById(created.id)).toBeNull();

    // No throw, no effect.
    await repo.delete(randomUUID());
  });

  it('raises DuplicateUserError on a duplicate username', async () => {
    const first = await repo.create(makeUser());
    const clash = makeUser({ username: first.username });

    let caught: unknown;
    try {
      await repo.create(clash);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(DuplicateUserError);
    expect((caught as DuplicateUserError).field).toBe('username');
  });

  it('raises DuplicateUserError on a duplicate email', async () => {
    const first = await repo.create(makeUser());
    const clash = makeUser({ email: first.email });

    let caught: unknown;
    try {
      await repo.create(clash);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(DuplicateUserError);
    expect((caught as DuplicateUserError).field).toBe('email');
  });
});
