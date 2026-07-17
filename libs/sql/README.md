# @schediochron/sql

The PostgreSQL adapter for Schediochron. It implements the repository interfaces
defined in [`@schediochron/core`](../core) against PostgreSQL.

## Client

This package uses Bun's built-in [`Bun.sql`](https://bun.sh/docs/api/sql)
PostgreSQL client — no external driver dependency. This mirrors the Bun-native
stance elsewhere in the stack (e.g. `Bun.password` for hashing in the API).

## Schema and migrations

The MVP schema lives in [`migrations/`](./migrations) as plain-SQL up/down pairs
named `<version>_<name>.up.sql` / `.down.sql`. Every table expresses a model in
`@schediochron/core` and the invariants its ADR fixes — see the comments in
[`0001_initial_schema.up.sql`](./migrations/0001_initial_schema.up.sql):

- `users`, `teams`, `team_members` (the join table behind the two-array Team
  model — `is_admin` marks admins, making `adminIds ⊆ memberIds` structural),
  `time_entries`, `refresh_tokens`.
- Password hashes live in a separate `user_credentials` table, **not** a `users`
  column: the `User` model and `UserRepository` are credential-free by design
  (ADR-002), so the hash is owned by the auth layer and never flows through the
  repository.
- One-running-entry-per-user (ADR-001) is enforced by a **partial unique index**
  on `time_entries (user_id) WHERE status = 'running'`, so a second clock-in
  fails at the database, not only in application code.
- No `duration` or `date` columns on `time_entries` — both are derived.

A dependency-free runner (`src/migrate.ts`) tracks applied versions in a
`schema_migrations` table and applies each migration in its own transaction.

```bash
export DATABASE_URL=postgres://user:pass@localhost:5432/schediochron
bun run --filter @schediochron/sql migrate          # apply pending (up)
bun run --filter @schediochron/sql migrate status    # list applied/pending
bun run --filter @schediochron/sql migrate down [n]  # revert the last n (default 1)
```

`DATABASE_URL` has no default — a missing value is a configuration error. A local
PostgreSQL to run these against is provided by the Docker Compose setup (#36).

## Status

Scaffolding beyond the schema. Still to land on top of this layout:

- `TimeEntry`, `User` and `Team` repositories (#26, #27, #28)
- Development seed data (#72)

## Scripts

- `bun run --filter @schediochron/sql build` — type-check and emit to `dist/`
- `bun run --filter @schediochron/sql test` — run the test suite
- `bun run --filter @schediochron/sql migrate` — apply migrations (see above)
