import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import type { SQL } from 'bun';
import { isRefreshTokenActive } from '@schediochron/core';
import { createSqlClient } from './db.js';
import { migrateUp } from './migrate.js';
import { SqlRefreshTokenRepository } from './refresh-token-repository.js';

// DB-backed round-trips. There is no live PostgreSQL in CI/dev here, so these
// skip unless DATABASE_URL points at a disposable database.
describe.skipIf(!process.env.DATABASE_URL)(
  'SqlRefreshTokenRepository (PostgreSQL)',
  () => {
    let sql: SQL;
    let repo: SqlRefreshTokenRepository;
    let userId: string;

    beforeAll(async () => {
      sql = createSqlClient();
      await migrateUp(sql);
      repo = new SqlRefreshTokenRepository(sql);
      // A refresh token references a user; make one to satisfy the FK.
      userId = randomUUID();
      await sql`
        INSERT INTO users (id, username, role)
        VALUES (${userId}, ${`rt_${userId.slice(0, 8)}`}, 'member')
      `;
    });

    afterAll(async () => {
      await sql?.close();
    });

    it('stores the token value as given and reads it back', async () => {
      const token = `hash_${randomUUID()}`;
      const expiresAt = new Date(Date.now() + 60_000).toISOString();
      const created = await repo.create({
        token,
        userId,
        expiresAt,
        revokedAt: null,
      });

      expect(created.token).toBe(token);
      expect(created.userId).toBe(userId);
      expect(created.revokedAt).toBeNull();
      // Timestamps come back as ISO 8601 UTC.
      expect(created.expiresAt).toMatch(/Z$/);
      expect(new Date(created.expiresAt).toISOString()).toBe(created.expiresAt);

      const found = await repo.findByToken(token);
      expect(found).toEqual(created);
      expect(found && isRefreshTokenActive(found)).toBe(true);
    });

    it('returns null for an unknown token', async () => {
      expect(await repo.findByToken(`missing_${randomUUID()}`)).toBeNull();
    });

    it('revoke sets revokedAt and makes the token inactive', async () => {
      const token = `hash_${randomUUID()}`;
      await repo.create({
        token,
        userId,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        revokedAt: null,
      });

      await repo.revoke(token);

      const found = await repo.findByToken(token);
      expect(found?.revokedAt).not.toBeNull();
      expect(found && isRefreshTokenActive(found)).toBe(false);
    });

    it('revoking an unknown or already-revoked token is a no-op', async () => {
      // Unknown token: no throw.
      await repo.revoke(`missing_${randomUUID()}`);

      const token = `hash_${randomUUID()}`;
      await repo.create({
        token,
        userId,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        revokedAt: null,
      });
      await repo.revoke(token);
      const firstRevokedAt = (await repo.findByToken(token))?.revokedAt;

      // Second revoke must not move revokedAt.
      await repo.revoke(token);
      expect((await repo.findByToken(token))?.revokedAt).toBe(firstRevokedAt);
    });

    it('revokeAllForUser revokes every live token for the user', async () => {
      const tokens = [
        `hash_${randomUUID()}`,
        `hash_${randomUUID()}`,
        `hash_${randomUUID()}`,
      ];
      for (const token of tokens) {
        await repo.create({
          token,
          userId,
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          revokedAt: null,
        });
      }

      await repo.revokeAllForUser(userId);

      for (const token of tokens) {
        const found = await repo.findByToken(token);
        expect(found?.revokedAt).not.toBeNull();
      }
    });
  },
);
