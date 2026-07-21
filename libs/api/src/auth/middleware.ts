import type { Context, MiddlewareHandler } from 'hono';
import type { Team, UserRole } from '@schediochron/core';
import { forbidden, unauthorized } from '../http.js';
import { verifyAccessToken } from './tokens.js';

/**
 * JWT authentication and authorisation for `@schediochron/api`.
 *
 * Two authorisation axes exist and are deliberately kept separate (ADR-002,
 * ADR-004):
 *
 *   1. the **system role** (`'admin' | 'member'`) carried in the access token —
 *      an account-level capability, checked with {@link requireSystemRole};
 *   2. **team-admin** rights over a *specific* team — decided against that
 *      team's membership, checked with {@link isTeamAdmin}.
 *
 * They are not the same check: a system `member` can administer a team, and a
 * system `admin` need not administer any given team.
 */

/** The authenticated caller, derived from a verified access token. */
export interface AuthenticatedUser {
  id: string;
  username: string;
  /** System role (ADR-002). */
  role: UserRole;
}

// Type the Hono context variable so `c.get('user')` / `c.set('user', …)` are
// checked against AuthenticatedUser rather than stashed untyped.
declare module 'hono' {
  interface ContextVariableMap {
    user: AuthenticatedUser;
  }
}

const BEARER = /^Bearer (.+)$/;

/**
 * Requires a valid `Authorization: Bearer <accessToken>`. Missing, malformed,
 * mis-signed, or expired tokens get 401 in the `ErrorResponse` envelope. On
 * success the decoded identity is attached to the context as `user`.
 */
export const requireAuth: MiddlewareHandler = async (c, next) => {
  const header = c.req.header('Authorization');
  const match = header ? BEARER.exec(header) : null;
  if (!match) {
    return unauthorized(c, 'Missing or malformed Authorization header');
  }
  try {
    const claims = await verifyAccessToken(match[1]);
    c.set('user', {
      id: claims.sub,
      username: claims.username,
      role: claims.role,
    });
  } catch {
    return unauthorized(c, 'Invalid or expired access token');
  }
  return next();
};

/**
 * Reads the authenticated user off the context. Throws if {@link requireAuth}
 * did not run first — a programming error, not a client error.
 */
export function getAuthenticatedUser(c: Context): AuthenticatedUser {
  const user = c.get('user');
  if (!user) {
    throw new Error(
      'getAuthenticatedUser called on a route that is not behind requireAuth',
    );
  }
  return user;
}

/**
 * System-role authorisation (ADR-002): answers 403 unless the caller's account
 * role is one of `allowed`. Reads the role from the token claim — no database
 * lookup, no team involved. Must run after {@link requireAuth}.
 */
export function requireSystemRole(...allowed: UserRole[]): MiddlewareHandler {
  return async (c, next) => {
    const user = getAuthenticatedUser(c);
    if (!allowed.includes(user.role)) {
      return forbidden(c, 'Insufficient role');
    }
    return next();
  };
}

/**
 * Team-admin authorisation (ADR-004): whether `userId` administers `team`. This
 * is the second, distinct axis — decided against the team's `adminIds`, not the
 * token — so it is a predicate the team endpoints (#32) apply with a loaded
 * `Team`, rather than a token-only middleware.
 */
export function isTeamAdmin(userId: string, team: Team): boolean {
  return team.adminIds.includes(userId);
}
