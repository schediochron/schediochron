# Changelog

Every `@schediochron/*` package shares one version: a release means the whole family works
together. See [ADR-007](./docs/adr/ADR-007-release-and-publishing.md) for how releases are cut.

## [0.2.0](https://github.com/schediochron/schediochron/compare/schediochron@v0.1.1...v0.2.0) (2026-07-16)

**Phase 1: Architecture Foundation.** The prototype becomes the modular monorepo the roadmap
describes — independently usable packages, a REST contract, and a toolchain of one.

### Features

- **`@schediochron/core`** — domain models (`TimeEntry`, `User`, `Team`) with Zod validators,
  repository interfaces, and the wire contract types the REST API exchanges (#18, #19, #83)
- **`@schediochron/react-components`** — `Calendar`, `Layout` and `getWeekArray` extracted from
  the prototype into a library usable in any React application (#21, #70)
- **`@schediochron/react-app`** — the web UI, now built on the component library (#20)
- **`@schediochron/api`** — a Hono backend routing all 23 operations of the REST contract,
  answering with stub payloads (#82, #83)
- **REST API contract** — OpenAPI 3.1 at `libs/api/openapi.yaml`, covering the MVP surface (#17)
- **Architecture Decision Records** — ADR-001 through ADR-007: the time entry, user and team
  models, the authentication flow, the REST contract, the API framework, and release/publishing

### Changes

- Restructured the monorepo into `apps/*` and `libs/*`, each a self-contained package
- **Removed Nx** — workspace scripts fan out with `bun run --filter '*'` in topological order
- **Removed Vite and Vitest** — Bun bundles (`bun build`), serves, and tests (`bun test`)
- **Removed SCSS** — styles are plain CSS relying on native nesting
- **Removed Release Please** — releases are cut by hand (ADR-007)
- Internal dependencies are declared with the `workspace:` protocol
- Agent instructions distilled into a single `AGENTS.md`; the mandated workflow, the devcontainer
  and the Copilot setup are gone
- The project moved to the [`schediochron`](https://github.com/schediochron) GitHub organisation

### Bug Fixes

- `bun run dev` served a blank page, because Bun's dev server cannot resolve `*.module.css`
  imports ([oven-sh/bun#18258](https://github.com/oven-sh/bun/issues/18258)). Styles are plain CSS
  now, and the E2E suite runs against the dev server as well as the built output, so the gap
  cannot reopen unnoticed (#123)
- Production bundles are built with `--production`, which selects React's production JSX runtime;
  minification or a `NODE_ENV` define alone yielded a bundle that threw at runtime

### Notes

Nothing is published to a registry yet — every package is still `private`, and distribution is a
Phase 5 concern. Tags and GitHub Releases are the historical record until then.

Tags now use `vX.Y.Z`. The earlier `schediochron@vX.Y.Z` format was an artifact of Release
Please's single-package configuration (ADR-007).

## [0.1.1](https://github.com/cyberniinja/schediochron/compare/schediochron@v0.1.0...schediochron@v0.1.1) (2026-03-24)

### Bug Fixes

- **#1:** fix case-sensitive import for Layout.scss ([c3b3f06](https://github.com/cyberniinja/schediochron/commit/c3b3f068210811a963fc5c79a9b8eeb8358eb0c7))
- **#1:** fix failing unit test and e2e lint errors ([d333c84](https://github.com/cyberniinja/schediochron/commit/d333c84cfba0f3fa8b1822111efb91746b73f5e1))
- **#1:** resolve CI lint and typecheck failures ([538fd4f](https://github.com/cyberniinja/schediochron/commit/538fd4fcd27437632d5656b74b4a4de030efacb6))

## [0.1.0](https://github.com/cyberniinja/schediochron/compare/schediochron@v0.0.1...schediochron@v0.1.0) (2026-03-24)

### Features

- **#1:** initial app implementation ([b9002fd](https://github.com/cyberniinja/schediochron/commit/b9002fd1fe489e29786a517f0617128994d552d6))
