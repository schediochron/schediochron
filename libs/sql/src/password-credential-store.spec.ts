import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import type { SQL } from 'bun';
import { createSqlClient } from './db.js';
import { migrateUp } from './migrate.js';
import { SqlPasswordCredentialStore } from './password-credential-store.js';

// DB-backed round-trips. There is no live PostgreSQL in CI/dev here, so these
// skip unless DATABASE_URL points at a disposable database.
describe.skipIf(!process.env.DATABASE_URL)(
  'SqlPasswordCredentialStore (PostgreSQL)',
  () => {
    let sql: SQL;
    let store: SqlPasswordCredentialStore;

    async function makeUser(): Promise<string> {
      const id = randomUUID();
      await sql`
        INSERT INTO users (id, username, role)
        VALUES (${id}, ${`cred_${id.slice(0, 8)}`}, 'member')
      `;
      return id;
    }

    beforeAll(async () => {
      sql = createSqlClient();
      await migrateUp(sql);
      store = new SqlPasswordCredentialStore(sql);
    });

    afterAll(async () => {
      await sql?.close();
    });

    it('returns null when the user has no credential', async () => {
      const userId = await makeUser();
      expect(await store.findPasswordHash(userId)).toBeNull();
    });

    it('set writes the hash and findPasswordHash reads it back', async () => {
      const userId = await makeUser();
      await store.set(userId, 'hash-one');
      expect(await store.findPasswordHash(userId)).toBe('hash-one');
    });

    it('set upserts — a second write replaces the hash in place', async () => {
      const userId = await makeUser();
      await store.set(userId, 'hash-one');
      await store.set(userId, 'hash-two');
      expect(await store.findPasswordHash(userId)).toBe('hash-two');
    });
  },
);
