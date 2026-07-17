// Public API — the PostgreSQL adapter for @schediochron/core.
//
// This package implements the repository interfaces from @schediochron/core
// against PostgreSQL, using Bun's native SQL client (`Bun.sql`). The repository
// implementations (#26, #27, #28) land on top of the schema and migrations here.

export { createSqlClient } from './db.js';

export { TeamSqlRepository, LastAdminError } from './team-repository.js';

export type { Migration, MigrationStatus } from './migrate.js';
export {
  discoverMigrations,
  pendingMigrations,
  migrationsToRevert,
  migrateUp,
  migrateDown,
  migrationStatus,
} from './migrate.js';
