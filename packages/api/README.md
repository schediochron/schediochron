# api

`@schediochron/api` — the backend HTTP API, built with [Hono](https://hono.dev) on Bun.

The framework choice is documented in
[ADR-006](../../docs/adr/ADR-006-api-framework.md), and the REST contract it implements in
[ADR-005](../../docs/adr/ADR-005-rest-api-contract.md).

## Running locally

Run `nx serve @schediochron/api` to start the server with hot reload (defaults to
`http://localhost:3000`; override with the `PORT` environment variable).

Verify it is up:

```sh
curl http://localhost:3000/health
# {"status":"ok","timestamp":"..."}
```

## Running unit tests

Run `nx test @schediochron/api` to execute the unit tests via [Vitest](https://vitest.dev/).

## Structure

- `src/app.ts` — runtime-agnostic Hono application (routes/middleware).
- `src/main.ts` — Bun entrypoint; the only runtime-specific glue.
- `src/index.ts` — public package exports.
