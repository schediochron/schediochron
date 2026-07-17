# @schediochron/sql

The PostgreSQL adapter for Schediochron. It implements the repository interfaces
defined in [`@schediochron/core`](../core) against PostgreSQL.

## Client

This package uses Bun's built-in [`Bun.sql`](https://bun.sh/docs/api/sql)
PostgreSQL client — no external driver dependency. This mirrors the Bun-native
stance elsewhere in the stack (e.g. `Bun.password` for hashing in the API).

## Status

Scaffolding. The following land on top of this layout:

- Schema and migrations (#25)
- `TimeEntry`, `User` and `Team` repositories (#26, #27, #28)
- Development seed data (#72)

## Scripts

- `bun run --filter @schediochron/sql build` — type-check and emit to `dist/`
- `bun run --filter @schediochron/sql test` — run the test suite
