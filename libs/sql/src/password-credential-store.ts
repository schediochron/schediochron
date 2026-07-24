import type { SQL } from 'bun';

/**
 * Server-side store for a user's password hash.
 *
 * `@schediochron/core` deliberately has no credential repository: the `User`
 * model and its repository are credential-free by design (ADR-002 — the hash
 * lives "only in the persistence layer", never on `User`). This interface is
 * therefore defined here, in the persistence adapter, rather than in core. It is
 * hash-agnostic: what a `passwordHash` string contains (argon2id, bcrypt, …) is
 * the auth layer's concern; this store only persists and retrieves it.
 */
export interface PasswordCredentialStore {
  /**
   * Writes the user's password hash, replacing any existing one (upsert). Used
   * both at registration and on password reset.
   */
  set(userId: string, passwordHash: string): Promise<void>;

  /**
   * The stored hash for the user, or `null` when the user has no credential —
   * a user row may exist before a credential is written (ADR-002).
   */
  findPasswordHash(userId: string): Promise<string | null>;
}

/** The `user_credentials` columns this store reads. */
interface CredentialRow {
  password_hash: string;
}

/**
 * PostgreSQL-backed {@link PasswordCredentialStore} over the `user_credentials`
 * table, using Bun's native SQL client.
 *
 * The table is keyed one-to-one on `user_id`, so `set` upserts: a first write
 * inserts, a later write (password change/reset) overwrites in place and
 * refreshes `updated_at`.
 */
export class SqlPasswordCredentialStore implements PasswordCredentialStore {
  constructor(private readonly sql: SQL) {}

  async set(userId: string, passwordHash: string): Promise<void> {
    await this.sql`
      INSERT INTO user_credentials (user_id, password_hash)
      VALUES (${userId}, ${passwordHash})
      ON CONFLICT (user_id) DO UPDATE
        SET password_hash = EXCLUDED.password_hash,
            updated_at = now()
    `;
  }

  async findPasswordHash(userId: string): Promise<string | null> {
    const rows = (await this.sql`
      SELECT password_hash
      FROM user_credentials
      WHERE user_id = ${userId}
    `) as CredentialRow[];
    return rows.length ? rows[0].password_hash : null;
  }
}
