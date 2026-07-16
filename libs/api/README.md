# api

`@schediochron/api` — the backend HTTP API, built with [Hono](https://hono.dev) on Bun.

The framework choice is documented in
[ADR-006](../../docs/adr/ADR-006-api-framework.md), and the REST contract it implements in
[ADR-005](../../docs/adr/ADR-005-rest-api-contract.md). The contract itself lives alongside
this package in [`openapi.yaml`](./openapi.yaml).

## Running locally

```bash
bun run dev:api
```

This starts the server with hot reload (defaults to `http://localhost:3000`; override with the
`PORT` environment variable).

Verify it is up:

```sh
curl http://localhost:3000/health
# {"status":"ok","timestamp":"..."}
```

## Running unit tests

```bash
bun run --filter @schediochron/api test
```

Tests run on [`bun test`](https://bun.com/docs/cli/test).

## Structure

- `src/app.ts` — runtime-agnostic Hono application; mounts the routes and the error envelope.
- `src/routes/` — one module per resource group, mirroring the tags in `openapi.yaml`.
- `src/stub-data.ts` — the sample payloads the stub routes return.
- `src/main.ts` — Bun entrypoint; the only runtime-specific glue.
- `src/index.ts` — public package exports.
- `openapi.yaml` — the REST contract this package implements.

## Status

Every operation in `openapi.yaml` is routed, but the handlers are stubs: they return fixed
payloads from `src/stub-data.ts`, shaped like the real responses and typed with
`@schediochron/core`. Authentication, authorisation and request validation are not implemented —
every endpoint answers as though the caller were authorised — and arrive in Phase 2 along with
persistence.
