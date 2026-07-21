// Public API
export { app } from './app.js';

export type { Repositories } from './repositories.js';
export {
  createRepositories,
  getRepositories,
  setRepositories,
  provideRepositories,
} from './repositories.js';

export type { AccessTokenClaims, AccessTokenSubject } from './auth/tokens.js';
export {
  InvalidAccessTokenError,
  getAccessTokenSecret,
  getAccessTokenTtlSeconds,
  signAccessToken,
  verifyAccessToken,
} from './auth/tokens.js';

export type { AuthenticatedUser } from './auth/middleware.js';
export {
  getAuthenticatedUser,
  isTeamAdmin,
  requireAuth,
  requireSystemRole,
} from './auth/middleware.js';
