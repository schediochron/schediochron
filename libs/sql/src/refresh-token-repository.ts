import type { SQL } from 'bun';
import type { RefreshToken, RefreshTokenRepository } from '@schediochron/core';

/**
 * The `refresh_tokens` row as Bun's SQL client hands it back: snake_case
 * columns, `timestamptz` values as `Date` (occasionally a string depending on
 * driver config, hence the union), `revoked_at` nullable.
 */
interface RefreshTokenRow {
  token: string;
  user_id: string;
  expires_at: Date | string;
  revoked_at: Date | string | null;
}

/** A `timestamptz` value from the driver as an ISO 8601 UTC string. */
function dbTimestampToIso(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

/** Maps a stored row to the {@link RefreshToken} model exactly. */
function mapRow(row: RefreshTokenRow): RefreshToken {
  return {
    token: row.token,
    userId: row.user_id,
    expiresAt: dbTimestampToIso(row.expires_at),
    revokedAt:
      row.revoked_at === null ? null : dbTimestampToIso(row.revoked_at),
  };
}

/**
 * PostgreSQL-backed {@link RefreshTokenRepository} over Bun's native SQL client.
 *
 * Hash-agnostic by design: the `token` value is stored and looked up exactly as
 * given. The auth layer (#30) passes the SHA-256 hash of the opaque token the
 * client holds, so this repository never sees or handles the raw token — it
 * treats `token` as a plain lookup key. `revoke`/`revokeAllForUser` set
 * `revoked_at = now()`; revoking an unknown or already-revoked token is a no-op.
 */
export class SqlRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly sql: SQL) {}

  async create(token: RefreshToken): Promise<RefreshToken> {
    const rows = (await this.sql`
      INSERT INTO refresh_tokens (token, user_id, expires_at, revoked_at)
      VALUES (${token.token}, ${token.userId}, ${token.expiresAt}, ${token.revokedAt})
      RETURNING token, user_id, expires_at, revoked_at
    `) as RefreshTokenRow[];
    return mapRow(rows[0]);
  }

  async findByToken(token: string): Promise<RefreshToken | null> {
    const rows = (await this.sql`
      SELECT token, user_id, expires_at, revoked_at
      FROM refresh_tokens
      WHERE token = ${token}
    `) as RefreshTokenRow[];
    return rows.length ? mapRow(rows[0]) : null;
  }

  async revoke(token: string): Promise<void> {
    // Only flip a live token; revoking an unknown or already-revoked token is a
    // no-op (the WHERE simply matches no rows).
    await this.sql`
      UPDATE refresh_tokens
      SET revoked_at = now()
      WHERE token = ${token} AND revoked_at IS NULL
    `;
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.sql`
      UPDATE refresh_tokens
      SET revoked_at = now()
      WHERE user_id = ${userId} AND revoked_at IS NULL
    `;
  }
}
