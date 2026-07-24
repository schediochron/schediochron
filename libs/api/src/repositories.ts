import type { SQL } from 'bun';
import type { MiddlewareHandler } from 'hono';
import type {
  RefreshTokenRepository,
  TeamRepository,
  TimeEntryRepository,
  UserRepository,
} from '@schediochron/core';
import {
  SqlPasswordCredentialStore,
  SqlRefreshTokenRepository,
  SqlTimeEntryRepository,
  SqlTeamRepository,
  SqlUserRepository,
  createSqlClient,
  type PasswordCredentialStore,
} from '@schediochron/sql';

/**
 * The database-wiring seam for the API.
 *
 * Route handlers depend on the repository interfaces from `@schediochron/core`,
 * never on a concrete client or on `@schediochron/sql` directly. The concrete
 * PostgreSQL repositories are built once, lazily, from `DATABASE_URL`, and put
 * on the Hono context by {@link provideRepositories}; handlers read them from
 * `c.get('repositories')`. Tests substitute fakes with {@link setRepositories}.
 *
 * Endpoints that need more persistence than the shared set below (e.g. auth's
 * refresh-token store, #30) extend {@link Repositories} and {@link createRepositories}.
 */
export interface Repositories {
  users: UserRepository;
  timeEntries: TimeEntryRepository;
  teams: TeamRepository;
  /** Server-side refresh-token store — revocation and rotation for auth (#30). */
  refreshTokens: RefreshTokenRepository;
  /** Password-hash store, keyed by user id — auth credentials (#30). */
  credentials: PasswordCredentialStore;
}

// Type the context variable so `c.get('repositories')` is `Repositories`.
declare module 'hono' {
  interface ContextVariableMap {
    repositories: Repositories;
  }
}

/** Builds the PostgreSQL-backed repositories over a single SQL client. */
export function createRepositories(sql: SQL): Repositories {
  return {
    users: new SqlUserRepository(sql),
    timeEntries: new SqlTimeEntryRepository(sql),
    teams: new SqlTeamRepository(sql),
    refreshTokens: new SqlRefreshTokenRepository(sql),
    credentials: new SqlPasswordCredentialStore(sql),
  };
}

let cached: Repositories | undefined;
let override: Repositories | undefined;

/**
 * The process-wide repositories, built lazily on first use so that importing
 * the app (as the test suite does) never opens a database connection. The
 * connection is read from `DATABASE_URL` via `createSqlClient` — no default.
 */
export function getRepositories(): Repositories {
  if (override) {
    return override;
  }
  if (!cached) {
    cached = createRepositories(createSqlClient());
  }
  return cached;
}

/**
 * Replace the repositories the app uses; pass `undefined` to restore the
 * lazily-built default. For tests, which inject fakes or a throwaway database.
 */
export function setRepositories(repositories: Repositories | undefined): void {
  override = repositories;
}

/**
 * Middleware that puts {@link getRepositories} on the context as `repositories`.
 * Applied by each data-backed route group, so handlers read the repositories
 * off the context rather than reaching for a module-level singleton.
 */
export const provideRepositories: MiddlewareHandler = async (c, next) => {
  c.set('repositories', getRepositories());
  await next();
};
