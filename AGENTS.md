# Schediochron — Agent Rules

Single source of instructions for AI agents working in this repo. There is no mandated workflow:
read the task, do the work, follow the rules below.

## Stack

Bun workspaces monorepo, TypeScript, React 19, Playwright, ESLint, Prettier. Bun does the
bundling (`bun build`), the dev server, and the testing (`bun test`). Workspace scripts are run
with `bun run --filter`.

Styles are plain CSS, relying on native nesting. `*.module.css` files are CSS modules, typed by
each package's `src/assets.d.ts`.

Every app and lib is a self-contained package with its own `src/`.

```
schediochron/
├── apps/
│   └── react-app/            # @schediochron/react-app — React app; e2e/ holds its Playwright specs
├── libs/
│   ├── core/                 # @schediochron/core — domain models and types
│   ├── react-components/     # @schediochron/react-components — shared UI
│   └── api/                  # @schediochron/api — Hono API (+ openapi.yaml contract)
├── docs/adr/                 # Architecture Decision Records
├── eslint.config.mjs         # Single flat config for the whole repo
├── tsconfig.json             # Project references — drives `tsc -b`
└── tsconfig.base.json
```

## Commands

Run from the repo root:

```bash
bun install        # Install dependencies
bun run dev        # React dev server (http://localhost:4200)
bun run dev:api    # API dev server (watch mode)
bun run build      # Build all projects (dependency order)
bun run typecheck  # tsc -b across all project references
bun run test       # Unit/integration tests
bun run e2e        # Playwright E2E — run `bun run build` first
bun run lint       # ESLint (bun run lint:fix to auto-fix)
bun run format     # Prettier
```

Target one workspace with `bun run --filter @schediochron/{name} {script}`.

## Rules

### Before committing

Run typecheck, test, and lint, and make sure they pass. Format with Prettier.

### Commits

Format: `{type}(#{issueNr}): description` — e.g. `feat(#42): add profile component`.
Types: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `style`.

Branch naming: `{type}/{issueNr}-{issue-name}`, where type is one of `feature`, `bug`, `chore`,
`refactoring` — e.g. `refactoring/96-replace-agent-files`.

### Pull requests

- No direct pushes to `main` — every change goes through a pull request.
- Never merge a pull request. Merging is a human-only action: stop after opening the PR.

### Roadmap and README

[ROADMAP.md](ROADMAP.md) carries the vision, the module architecture every package is a piece of,
and where the codebase currently stands. [README.md](README.md) carries the repository layout and
the commands to run it. Between them they are what a newcomer reads first, and they go stale
silently — nothing fails when they drift.

So when a change makes part of them untrue, fix it in the same change:

- a module lands, is renamed, or moves between phases
- the architecture table or the structure block stops matching the packages and directories that
  exist
- a documented command changes, or the way the project is built, served or tested changes
- "Current State" describes work that is now done

Describe what is true now rather than appending a changelog. If you are unsure whether a change
is worth documenting, raise it instead of deciding silently — docs nobody trusts are worse than
no docs.

Per-issue progress belongs on the project board and in GitHub issues; ROADMAP.md holds the
narrative, not the checklist.

### Package contents

Each lib has a `files` allowlist in its `package.json`: whatever is not listed is not published,
silently. The libs are `private` today but are intended for a registry, so keep the allowlist
honest as you go.

Whenever you add a file a consumer would need at runtime — a new entrypoint, an asset, a
generated artifact like `openapi.yaml`, anything an `exports` condition points at — add it to
`files` in the same change. Whenever you add a build- or test-only file, keep it out. If you
cannot tell which side a file belongs on, ask rather than guess: a missing file breaks consumers
only after publishing, and a stray one leaks internals forever.

`bun pm pack` in a package prints exactly what would ship — check it when you change build
outputs, `exports`, or the layout of a package.

### Code

- TypeScript strict mode is enforced — always provide proper type annotations.
- Functional React components only; hooks for state and side effects; props typed with interfaces.
- Lint enforces the Rules of React via the React Compiler's analysis rules (purity, immutability,
  set-state-in-render, …). Fix violations rather than suppressing them: they are the preconditions
  for turning the compiler itself on later.
- Styles live in separate CSS module files (`*.module.css`).
- Build production bundles with `--production`: it selects React's production JSX runtime.
  `--minify` or a `NODE_ENV` define alone yields a bundle that throws at runtime.
- The React packages preload `happydom.ts` then `test-setup.ts`, in that order — Testing Library
  binds `screen` at import time and needs the DOM registered first.
- No `console.error` or `console.warn` in production code.
- The filename suffix picks the runner, so keep it accurate: `*.spec.ts(x)` are unit/integration
  tests run by `bun test` (import from `bun:test`, Testing Library for components), and `*.e2e.ts`
  are Playwright tests living in the app's `e2e/` folder. Name an e2e test `*.spec.ts` and
  `bun test` will try to run it and fail.
- E2E tests cover user flows, not implementation details.
- Adding a workspace: create it under `apps/` or `libs/`, give it the scripts the root scripts
  expect (`build`, `test`, …), and add it to the `references` in `tsconfig.json`.

### Ask before deciding

Raise architectural decisions, scope ambiguity, conflicting requirements, and dependency
conflicts with the developer rather than resolving them unilaterally.
