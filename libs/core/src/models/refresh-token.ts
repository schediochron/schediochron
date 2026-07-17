import { z } from 'zod';

/**
 * An issued refresh token, persisted so it can be revoked.
 *
 * Unlike access tokens, which are stateless signed JWTs, refresh tokens are
 * opaque — validity is decided by lookup, not by signature, so this record is
 * the source of truth for whether the token still works.
 */
export interface RefreshToken {
  token: string; // opaque; unique system-wide; the lookup key
  userId: string; // UUID v4; the user the token authenticates
  expiresAt: string; // ISO 8601 UTC
  revokedAt: string | null; // ISO 8601 UTC; null while the token is live
}

export const refreshTokenSchema = z.object({
  token: z.string().min(1, 'Refresh token must not be empty'),
  userId: z.string().uuid(),
  expiresAt: z.string().datetime({ offset: false }),
  revokedAt: z.string().datetime({ offset: false }).nullable(),
});

export function validateRefreshToken(
  data: unknown,
): z.SafeParseReturnType<RefreshToken, RefreshToken> {
  return refreshTokenSchema.safeParse(data) as z.SafeParseReturnType<
    RefreshToken,
    RefreshToken
  >;
}

/** A token is usable only while neither revoked nor expired. */
export function isRefreshTokenActive(
  token: RefreshToken,
  now: Date = new Date(),
): boolean {
  if (token.revokedAt !== null) {
    return false;
  }
  return new Date(token.expiresAt).getTime() > now.getTime();
}
