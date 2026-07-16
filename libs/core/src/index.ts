// Public API
export type { TimeEntryStatus, TimeEntry } from './models/time-entry.js';
export { timeEntrySchema, validateTimeEntry } from './models/time-entry.js';

export type { UserRole, User } from './models/user.js';
export { userSchema, validateUser } from './models/user.js';

export type { Team } from './models/team.js';
export { teamSchema, validateTeam } from './models/team.js';

export type { TimeEntryRepository } from './repositories/time-entry-repository.js';
export type { UserRepository } from './repositories/user-repository.js';
export type { TeamRepository } from './repositories/team-repository.js';

export { computeDuration } from './utils/time-entry.js';

// Wire contract — the shapes crossing the HTTP boundary (openapi.yaml).
// Types only: request validation lives in the API layer (#71).
export type { ErrorResponse } from './contract/error.js';
export type {
  TokenPair,
  AuthResponse,
  RegisterRequest,
  LoginRequest,
  RefreshRequest,
  LogoutRequest,
} from './contract/auth.js';
export type {
  UpdateUserRequest,
  AdminPasswordResetRequest,
} from './contract/user.js';
export type {
  CreateTimeEntryRequest,
  UpdateTimeEntryRequest,
  StartTimeEntryRequest,
  StopTimeEntryRequest,
  ListTimeEntriesQuery,
} from './contract/time-entry.js';
export type {
  CreateTeamRequest,
  UpdateTeamRequest,
  AddTeamMemberRequest,
} from './contract/team.js';
export type {
  HoursReportRange,
  HoursReportDay,
  HoursReportQuery,
} from './contract/report.js';
