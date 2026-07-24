import { randomUUID } from 'node:crypto';
import type { Context } from 'hono';
import type { AuthResponse, TokenPair, User } from '@schediochron/core';
import { isRefreshTokenActive } from '@schediochron/core';
import { DuplicateUserError } from '@schediochron/sql';
import {
  badRequest,
  conflict,
  createRouter,
  formatZodIssues,
  unauthorized,
} from '../http.js';
import {
  loginRequestSchema,
  logoutRequestSchema,
  refreshRequestSchema,
  registerRequestSchema,
} from '../schemas.js';
import { provideRepositories, type Repositories } from '../repositories.js';
import { requireAuth } from '../auth/middleware.js';
import { signAccessToken } from '../auth/tokens.js';
import { hashRefreshToken, mintRefreshToken } from '../auth/refresh-tokens.js';

/**
 * `/auth` — authentication and token management (ADR-003), backed by the
 * database via the repository seam (#30).
 *
 * Register, login, and refresh are public; only logout is behind `requireAuth`.
 * Passwords are hashed with `Bun.password` (argon2id). Refresh tokens are opaque
 * random strings stored only as their SHA-256 hash, revocable on logout and
 * rotated on refresh; `passwordHash` never leaves the persistence layer.
 */
export const authRoutes = createRouter();

authRoutes.use('*', provideRepositories);
// register / login / refresh are public; protect only logout.
authRoutes.use('/logout', requireAuth);

/**
 * Reads and JSON-parses the request body, returning `null` on a malformed body
 * so the caller can answer 400 rather than let the parse error escape.
 */
async function readJsonBody(c: Context): Promise<unknown | null> {
  try {
    return (await c.req.json()) as unknown;
  } catch {
    return null;
  }
}

/**
 * Issues a fresh token pair for the user: a signed access token plus a newly
 * minted refresh token whose hash is persisted for later revocation.
 */
async function issueTokenPair(
  repos: Repositories,
  user: Pick<User, 'id' | 'username' | 'role'>,
): Promise<TokenPair> {
  const accessToken = await signAccessToken({
    id: user.id,
    username: user.username,
    role: user.role,
  });
  const minted = mintRefreshToken(user.id);
  await repos.refreshTokens.create(minted.record);
  return { accessToken, refreshToken: minted.opaqueToken };
}

// --- POST /auth/register (201, public) ---
authRoutes.post('/register', async (c) => {
  const body = await readJsonBody(c);
  const parsed = registerRequestSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(c, 'Validation failed', formatZodIssues(parsed.error));
  }
  const { username, password, displayName, email } = parsed.data;

  const passwordHash = await Bun.password.hash(password);
  const repos = c.get('repositories');

  let user: User;
  try {
    user = await repos.users.create({
      id: randomUUID(),
      username,
      displayName: displayName ?? null,
      email: email ?? null,
      role: 'member',
      // createdAt/updatedAt are set by the persistence layer on write.
      createdAt: '',
      updatedAt: '',
    });
  } catch (err) {
    if (err instanceof DuplicateUserError) {
      return conflict(c, `The ${err.field} is already taken`);
    }
    throw err;
  }

  // The user row exists; write its credential. A user without a credential
  // simply cannot authenticate (ADR-002), so this is safe to do as a second
  // write rather than one transaction across the repository seam.
  await repos.credentials.set(user.id, passwordHash);

  const tokens = await issueTokenPair(repos, user);
  const response: AuthResponse = { user, ...tokens };
  return c.json(response, 201);
});

// --- POST /auth/login (200, public, by username) ---
authRoutes.post('/login', async (c) => {
  const body = await readJsonBody(c);
  const parsed = loginRequestSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(c, 'Validation failed', formatZodIssues(parsed.error));
  }
  const { username, password } = parsed.data;
  const repos = c.get('repositories');

  // Do not distinguish which of the two was wrong: unknown user, missing
  // credential, and bad password all answer the same 401.
  const user = await repos.users.findByUsername(username);
  if (!user) {
    return unauthorized(c, 'Invalid username or password');
  }
  const passwordHash = await repos.credentials.findPasswordHash(user.id);
  if (!passwordHash) {
    return unauthorized(c, 'Invalid username or password');
  }
  const ok = await Bun.password.verify(password, passwordHash);
  if (!ok) {
    return unauthorized(c, 'Invalid username or password');
  }

  const tokens = await issueTokenPair(repos, user);
  const response: AuthResponse = { user, ...tokens };
  return c.json(response, 200);
});

// --- POST /auth/refresh (200, public) ---
authRoutes.post('/refresh', async (c) => {
  const body = await readJsonBody(c);
  const parsed = refreshRequestSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(c, 'Validation failed', formatZodIssues(parsed.error));
  }
  const repos = c.get('repositories');

  const hash = hashRefreshToken(parsed.data.refreshToken);
  const stored = await repos.refreshTokens.findByToken(hash);
  if (!stored || !isRefreshTokenActive(stored)) {
    return unauthorized(c, 'Refresh token not found, expired, or revoked');
  }

  // The access token carries username and role, which the token record does
  // not, so load the user. A token for a deleted user is unusable.
  const user = await repos.users.findById(stored.userId);
  if (!user) {
    return unauthorized(c, 'Refresh token not found, expired, or revoked');
  }

  // Rotate (ADR-003): mint a new refresh token and revoke the presented one, so
  // a leaked token is single-use.
  const tokens = await issueTokenPair(repos, user);
  await repos.refreshTokens.revoke(hash);
  return c.json(tokens satisfies TokenPair, 200);
});

// --- POST /auth/logout (204, protected) ---
authRoutes.post('/logout', async (c) => {
  const body = await readJsonBody(c);
  const parsed = logoutRequestSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(c, 'Validation failed', formatZodIssues(parsed.error));
  }
  const repos = c.get('repositories');

  // Revoking an unknown or already-revoked token is a no-op; logout is
  // idempotent and always answers 204.
  await repos.refreshTokens.revoke(hashRefreshToken(parsed.data.refreshToken));
  return c.body(null, 204);
});
