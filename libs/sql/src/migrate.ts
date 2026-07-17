import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SQL } from 'bun';
import { createSqlClient } from './db.js';

/**
 * A plain-SQL migration runner. Each migration is a pair of files under
 * `migrations/`, `<version>_<name>.up.sql` and `<version>_<name>.down.sql`;
 * applied versions are tracked in a `schema_migrations` table so `up` is
 * idempotent and `down` reverses in the opposite order.
 *
 * Deliberately dependency-free: migrations stay readable SQL rather than a
 * library's DSL, consistent with the Bun-native, zero-driver stance of the rest
 * of the adapter.
 */

const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'migrations',
);

export interface Migration {
  /** Zero-padded ordering key, e.g. `"0001"`. */
  version: string;
  /** Human-readable slug, e.g. `"initial_schema"`. */
  name: string;
  /** Absolute path to the `.up.sql` file. */
  upPath: string;
  /** Absolute path to the `.down.sql` file. */
  downPath: string;
}

const UP_SUFFIX = '.up.sql';

/**
 * Reads the migration directory into an ordered list, validating that every
 * `.up.sql` is well-named and has a matching `.down.sql`. Ordering is by
 * version, which the zero-padded filenames make a plain string sort.
 */
export function discoverMigrations(dir: string = MIGRATIONS_DIR): Migration[] {
  const files = readdirSync(dir);
  const migrations = files
    .filter((f) => f.endsWith(UP_SUFFIX))
    .sort()
    .map((up) => {
      const base = up.slice(0, -UP_SUFFIX.length);
      const match = /^(\d+)_(.+)$/.exec(base);
      if (!match) {
        throw new Error(
          `Migration "${up}" must be named <version>_<name>${UP_SUFFIX}`,
        );
      }
      const down = `${base}.down.sql`;
      if (!files.includes(down)) {
        throw new Error(`Migration "${up}" has no matching "${down}"`);
      }
      return {
        version: match[1],
        name: match[2],
        upPath: join(dir, up),
        downPath: join(dir, down),
      } satisfies Migration;
    });

  const seen = new Set<string>();
  for (const m of migrations) {
    if (seen.has(m.version)) {
      throw new Error(`Duplicate migration version "${m.version}"`);
    }
    seen.add(m.version);
  }
  return migrations;
}

/** Migrations not yet recorded as applied, in ascending order. */
export function pendingMigrations(
  all: Migration[],
  applied: ReadonlySet<string>,
): Migration[] {
  return all.filter((m) => !applied.has(m.version));
}

/** The `steps` most-recently-applied migrations, newest first (revert order). */
export function migrationsToRevert(
  all: Migration[],
  applied: ReadonlySet<string>,
  steps: number,
): Migration[] {
  return all
    .filter((m) => applied.has(m.version))
    .reverse()
    .slice(0, Math.max(0, steps));
}

async function ensureMigrationsTable(sql: SQL): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    text        PRIMARY KEY,
      name       text        NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`;
}

async function appliedVersions(sql: SQL): Promise<Set<string>> {
  const rows = (await sql`SELECT version FROM schema_migrations`) as Array<{
    version: string;
  }>;
  return new Set(rows.map((r) => r.version));
}

/**
 * Applies every pending migration in order. Each runs in its own transaction
 * together with the `schema_migrations` insert, so a failing migration leaves
 * neither half-applied DDL nor a bookkeeping row behind (Postgres DDL is
 * transactional). Returns the versions applied.
 */
export async function migrateUp(
  sql: SQL,
  all: Migration[] = discoverMigrations(),
): Promise<string[]> {
  await ensureMigrationsTable(sql);
  const pending = pendingMigrations(all, await appliedVersions(sql));
  const applied: string[] = [];
  for (const m of pending) {
    const ddl = readFileSync(m.upPath, 'utf8');
    await sql.begin(async (tx) => {
      await tx.unsafe(ddl);
      await tx`INSERT INTO schema_migrations (version, name) VALUES (${m.version}, ${m.name})`;
    });
    applied.push(m.version);
  }
  return applied;
}

/**
 * Reverts the `steps` most recent migrations (default 1), newest first, each in
 * a transaction with its bookkeeping delete. Returns the versions reverted.
 */
export async function migrateDown(
  sql: SQL,
  steps = 1,
  all: Migration[] = discoverMigrations(),
): Promise<string[]> {
  await ensureMigrationsTable(sql);
  const target = migrationsToRevert(all, await appliedVersions(sql), steps);
  const reverted: string[] = [];
  for (const m of target) {
    const ddl = readFileSync(m.downPath, 'utf8');
    await sql.begin(async (tx) => {
      await tx.unsafe(ddl);
      await tx`DELETE FROM schema_migrations WHERE version = ${m.version}`;
    });
    reverted.push(m.version);
  }
  return reverted;
}

export interface MigrationStatus extends Migration {
  applied: boolean;
}

/** Every migration with whether it is currently applied, in order. */
export async function migrationStatus(
  sql: SQL,
  all: Migration[] = discoverMigrations(),
): Promise<MigrationStatus[]> {
  await ensureMigrationsTable(sql);
  const applied = await appliedVersions(sql);
  return all.map((m) => ({ ...m, applied: applied.has(m.version) }));
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'up';
  const sql = createSqlClient();
  try {
    switch (command) {
      case 'up': {
        const applied = await migrateUp(sql);
        console.log(
          applied.length
            ? `Applied ${applied.length} migration(s): ${applied.join(', ')}`
            : 'No pending migrations.',
        );
        break;
      }
      case 'down': {
        const steps = Number(process.argv[3] ?? '1');
        if (!Number.isInteger(steps) || steps < 1) {
          throw new Error(`down expects a positive step count, got "${process.argv[3]}"`);
        }
        const reverted = await migrateDown(sql, steps);
        console.log(
          reverted.length
            ? `Reverted ${reverted.length} migration(s): ${reverted.join(', ')}`
            : 'Nothing to revert.',
        );
        break;
      }
      case 'status': {
        for (const m of await migrationStatus(sql)) {
          console.log(`${m.applied ? '✔' : '·'} ${m.version} ${m.name}`);
        }
        break;
      }
      default:
        console.info(`Unknown command "${command}". Use: up | down [n] | status`);
        process.exitCode = 1;
    }
  } finally {
    await sql.close();
  }
}

if (import.meta.main) {
  await main();
}
