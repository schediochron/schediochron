# @schediochron/core

Domain models and TypeScript types shared across the workspace.

`src/models` holds the domain entities and their Zod validators, `src/repositories` the
persistence interfaces, and `src/contract` the request and response shapes that cross the HTTP
boundary in [`openapi.yaml`](../api/openapi.yaml) — types only, so consumers of the contract do
not depend on the API package.

## Building

```bash
bun run --filter @schediochron/core build
```

## Running unit tests

```bash
bun run --filter @schediochron/core test
```

Tests run on [`bun test`](https://bun.com/docs/cli/test).
