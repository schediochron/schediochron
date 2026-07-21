import { sign, verify } from 'hono/jwt';
import type { UserRole } from '@schediochron/core';

/**
 * Access-token issuing and verification (ADR-003).
 *
 * Access tokens are stateless signed JWTs: they carry the user's id, username,
 * and system role as claims, so middleware can authorise without a database
 * lookup. They are HMAC-signed with a secret that has **no default** — a missing
 * secret is a configuration error, never something to paper over.
 */

const SECRET_ENV = 'ACCESS_TOKEN_SECRET';
const TTL_ENV = 'ACCESS_TOKEN_TTL_SECONDS';
const DEFAULT_TTL_SECONDS = 15 * 60;
const ALG = 'HS256';

/** The claims carried by an access token (ADR-003). */
export interface AccessTokenClaims {
  /** Subject — the user id (UUID v4). */
  sub: string;
  username: string;
  /** System role (ADR-002) — `'admin' | 'member'`. */
  role: UserRole;
  /** Issued-at, seconds since the epoch. */
  iat: number;
  /** Expiry, seconds since the epoch. */
  exp: number;
}

/** The identity an access token is minted for. */
export interface AccessTokenSubject {
  id: string;
  username: string;
  role: UserRole;
}

/** Thrown when a token is absent-of-claims, malformed, mis-signed, or expired. */
export class InvalidAccessTokenError extends Error {
  constructor(message = 'Invalid or expired access token') {
    super(message);
    this.name = 'InvalidAccessTokenError';
  }
}

/**
 * The HMAC signing secret, from `ACCESS_TOKEN_SECRET`. Throws when unset or
 * empty — there is deliberately no usable default.
 */
export function getAccessTokenSecret(): string {
  const secret = process.env[SECRET_ENV];
  if (!secret) {
    throw new Error(
      `${SECRET_ENV} is not set — the API cannot sign or verify access tokens without a signing secret.`,
    );
  }
  return secret;
}

/**
 * Access-token lifetime in seconds, from `ACCESS_TOKEN_TTL_SECONDS` (a config
 * concern per ADR-003), defaulting to 15 minutes. A short lifetime is the point
 * of the dual-token scheme; the refresh token carries the long-lived session.
 */
export function getAccessTokenTtlSeconds(): number {
  const raw = process.env[TTL_ENV];
  if (raw === undefined) {
    return DEFAULT_TTL_SECONDS;
  }
  const seconds = Number(raw);
  if (!Number.isInteger(seconds) || seconds <= 0) {
    throw new Error(
      `${TTL_ENV} must be a positive integer of seconds, got "${raw}"`,
    );
  }
  return seconds;
}

/** Mints a signed access token for the subject. */
export async function signAccessToken(
  subject: AccessTokenSubject,
  options: { secret?: string; ttlSeconds?: number; now?: number } = {},
): Promise<string> {
  const secret = options.secret ?? getAccessTokenSecret();
  const ttlSeconds = options.ttlSeconds ?? getAccessTokenTtlSeconds();
  const iat = options.now ?? Math.floor(Date.now() / 1000);
  return sign(
    {
      sub: subject.id,
      username: subject.username,
      role: subject.role,
      iat,
      exp: iat + ttlSeconds,
    },
    secret,
    ALG,
  );
}

function hasAccessTokenClaims(payload: Record<string, unknown>): boolean {
  return (
    typeof payload.sub === 'string' &&
    typeof payload.username === 'string' &&
    (payload.role === 'admin' || payload.role === 'member') &&
    typeof payload.iat === 'number' &&
    typeof payload.exp === 'number'
  );
}

/**
 * Verifies signature and expiry and returns the typed claims. Every failure —
 * bad signature, malformed token, expired token, or a token missing the claims
 * we require — surfaces as {@link InvalidAccessTokenError}, so callers never see
 * the underlying JWT library errors.
 */
export async function verifyAccessToken(
  token: string,
  secret: string = getAccessTokenSecret(),
): Promise<AccessTokenClaims> {
  let payload: Record<string, unknown>;
  try {
    payload = await verify(token, secret, ALG);
  } catch {
    throw new InvalidAccessTokenError();
  }
  if (!hasAccessTokenClaims(payload)) {
    throw new InvalidAccessTokenError(
      'Access token is missing required claims',
    );
  }
  return {
    sub: payload.sub as string,
    username: payload.username as string,
    role: payload.role as UserRole,
    iat: payload.iat as number,
    exp: payload.exp as number,
  };
}
