import { randomBytes, randomUUID } from 'node:crypto';
import type { RefreshToken } from '@schediochron/core';

/**
 * Refresh-token minting and hashing (ADR-003).
 *
 * Refresh tokens are opaque random strings. The value handed to the client is
 * never stored; only its SHA-256 hash is persisted, so a leaked database cannot
 * be replayed against the refresh endpoint. Lookups hash the incoming token and
 * compare hashes. This module owns both halves — generate + hash — so the route
 * never handles the raw token past the response it returns.
 */

const TTL_ENV = 'REFRESH_TOKEN_TTL_SECONDS';
const DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

/**
 * Refresh-token lifetime in seconds, from `REFRESH_TOKEN_TTL_SECONDS` (a config
 * concern per ADR-003), defaulting to 30 days. The refresh token carries the
 * long-lived session; the access token stays short.
 */
export function getRefreshTokenTtlSeconds(): number {
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

/** Generates an opaque refresh token with ample entropy (UUID + 32 bytes). */
export function generateRefreshToken(): string {
  return `${randomUUID()}.${randomBytes(32).toString('hex')}`;
}

/** The SHA-256 hash (hex) of an opaque token — the value stored server-side. */
export function hashRefreshToken(token: string): string {
  return new Bun.CryptoHasher('sha256').update(token).digest('hex');
}

/** An opaque token to hand the client, paired with the record to persist. */
export interface MintedRefreshToken {
  /** The opaque value returned to the client. Never stored. */
  opaqueToken: string;
  /** The record to persist — `token` is the hash, not the opaque value. */
  record: RefreshToken;
}

/**
 * Mints a fresh refresh token for the user: a random opaque value for the
 * client and a persistable record holding only its hash, with an expiry set
 * from the configured TTL and `revokedAt` null.
 */
export function mintRefreshToken(
  userId: string,
  now: Date = new Date(),
): MintedRefreshToken {
  const opaqueToken = generateRefreshToken();
  const expiresAt = new Date(
    now.getTime() + getRefreshTokenTtlSeconds() * 1000,
  ).toISOString();
  return {
    opaqueToken,
    record: {
      token: hashRefreshToken(opaqueToken),
      userId,
      expiresAt,
      revokedAt: null,
    },
  };
}
