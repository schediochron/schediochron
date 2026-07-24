// Public API — the PostgreSQL adapter for @schediochron/core.
//
// This package implements the repository interfaces from @schediochron/core
// against PostgreSQL, using Bun's native SQL client (`Bun.sql`). The repository
// implementations (#26, #27, #28) land on top of the schema and migrations here.

export { createSqlClient } from './db.js';

export type { Migration, MigrationStatus } from './migrate.js';
export {
  discoverMigrations,
  pendingMigrations,
  migrationsToRevert,
  migrateUp,
  migrateDown,
  migrationStatus,
} from './migrate.js';

export {
  SqlTimeEntryRepository,
  RunningEntryExistsError,
} from './time-entry-repository.js';

export type { DuplicateUserField } from './user-repository.js';
export { DuplicateUserError, SqlUserRepository } from './user-repository.js';

export { SqlTeamRepository, LastAdminError } from './team-repository.js';
