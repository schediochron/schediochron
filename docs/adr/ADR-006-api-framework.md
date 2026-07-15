# ADR-006: API Framework

**Status**: Accepted  
**Date**: 2026-07-15  
**Issue**: [#82 — scaffold `@schediochron/api` package and evaluate API framework](https://github.com/cyberniinja/schediochron/issues/82)

---

## Context

The MVP needs a backend that implements the REST API contract defined in
[ADR-005](./ADR-005-rest-api-contract.md) (`openapi.yaml`, OpenAPI 3.1). Before endpoint
implementation can begin, the `@schediochron/api` package must exist and a framework must be
chosen.

The workspace already commits to a runtime and toolchain that constrain the decision:

- **Bun** is the package manager and runtime (`bun.lock`, `bun@1.3.11`).
- The codebase is **TypeScript-first** with strict compiler settings and ESM (`nodenext`).
- `@schediochron/core` already uses **Zod** for model validation, and the API contract is an
  **OpenAPI 3.1** document — so first-class Zod/OpenAPI integration is valuable for keeping the
  implementation and the contract in sync.

The framework should therefore be Bun-native, TypeScript-first, have a healthy middleware
ecosystem, perform well, and — per the issue — leave the door open to a framework-agnostic
adapter so we are not locked to a single runtime or hosting model.

## Options Considered

| Framework          | Bun support                     | TS-first                    | Runtime-agnostic                                             | Ecosystem                        | Notes                                                            |
| ------------------ | ------------------------------- | --------------------------- | ----------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------- |
| **Hono**           | First-class (official adapter)  | Yes, excellent inference    | Yes — Web-standard `Request`/`Response`, adapters per runtime | Large, actively maintained       | `@hono/zod-openapi` binds Zod schemas to the OpenAPI contract   |
| **Elysia**         | First-class (Bun-native)        | Yes, best-in-class          | No — tightly coupled to Bun                                  | Growing, smaller                 | Fastest on Bun, but Bun lock-in works against the adapter goal  |
| **Express**        | Works via Node compat           | Types are add-on (`@types`) | Node-centric                                                 | Largest, mature                  | Callback-era design, no Web-standard primitives, weak TS story  |
| **Fastify**        | Works via Node compat           | Good with plugins           | Node-centric                                                 | Large                            | Solid, but Node-oriented and heavier than needed for the MVP    |

### Evaluation against the criteria

- **Bun compatibility / native support** — Hono and Elysia both target Bun directly. Express and
  Fastify run only through Bun's Node-compatibility layer, forgoing Web-standard primitives.
- **TypeScript-first design** — Hono and Elysia are built around type inference; Express requires
  external `@types`. Hono's inference is strong without the Bun coupling Elysia's brings.
- **Middleware ecosystem** — Express has the largest ecosystem, but Hono ships a comprehensive
  built-in middleware set (CORS, JWT, logger, compression) plus a first-party `@hono/*` line
  including `@hono/zod-openapi` and `@hono/zod-validator`.
- **Performance** — All four are adequate for the MVP. Elysia leads micro-benchmarks on Bun;
  Hono is close behind and far ahead of Express. Performance is not a differentiator at this
  scale.
- **Community and ecosystem size** — Express is largest but legacy-shaped. Hono has strong,
  current momentum and broad runtime coverage; Elysia is smaller and Bun-specific.
- **Likelihood of a framework-agnostic adapter later** — This is the deciding factor. Hono is
  built on Web-standard `Request`/`Response` and ships adapters for Bun, Node, Deno, Cloudflare
  Workers, Vercel, and AWS Lambda. The same application object runs across runtimes with only the
  entrypoint changed. Elysia optimises for Bun at the cost of portability.

## Decision

Use **[Hono](https://hono.dev)** for `@schediochron/api`.

Hono is the only option that satisfies every criterion simultaneously: Bun-native, excellent
TypeScript inference, a healthy middleware ecosystem, strong performance, and — decisively —
runtime portability via Web-standard primitives. It also integrates cleanly with the existing
Zod usage and the OpenAPI 3.1 contract through `@hono/zod-openapi`, which lets us derive
request/response validation from the same schemas that document the API.

The application is authored as a runtime-agnostic Hono instance (`app.ts`) exporting a standard
`fetch` handler. The Bun entrypoint (`main.ts`) is a thin adapter. Moving to another runtime later
means swapping the entrypoint, not rewriting the application.

## Consequences

- **Positive** — Portable across runtimes; strong types; contract-driven validation available via
  `@hono/zod-openapi`; small dependency footprint; no Bun lock-in.
- **Negative** — Smaller middleware ecosystem than Express; some Node-only libraries may need
  Web-standard equivalents.
- **Follow-up** — When implementing contract endpoints, adopt `@hono/zod-openapi` so routes are
  validated against, and kept in sync with, `openapi.yaml`.
