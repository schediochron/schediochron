import type { RefreshToken } from '../models/refresh-token.js';

/**
 * Server-side refresh token storage — the record that makes a token revocable.
 * Where it lives (memory, SQL, Redis) is the adapter's choice.
 *
 * Not a `CrudRepository`: tokens are addressed by their opaque value rather
 * than an id, are never updated in place (rotation mints a new token and
 * revokes the old), and are never listed in bulk.
 */
export interface RefreshTokenRepository {
  /** Persists a newly minted token. */
  create(token: RefreshToken): Promise<RefreshToken>;

  /**
   * Looks up by opaque value — the only handle a client holds. `null` when
   * never issued; a found token still needs its expiry and revocation checked.
   */
  findByToken(token: string): Promise<RefreshToken | null>;

  /** Revoking an unknown or already-revoked token is a no-op. */
  revoke(token: string): Promise<void>;

  /** Revokes every token for the user, live or not. */
  revokeAllForUser(userId: string): Promise<void>;
}
