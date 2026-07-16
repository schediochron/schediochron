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
│   ├── react-app/            # @schediochron/react-app — main React app
│   └── react-app-e2e/        # @schediochron/react-app-e2e — Playwright E2E
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
bun run test       # Unit/integration tests (Vitest)
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
- Unit/integration tests: named `*.spec.ts(x)` or `*.test.ts(x)`, importing from `bun:test`,
  Testing Library for components. E2E: Playwright in `apps/react-app-e2e/src/` — test user flows,
  not implementation details.
- Adding a workspace: create it under `apps/` or `libs/`, give it the scripts the root scripts
  expect (`build`, `test`, …), and add it to the `references` in `tsconfig.json`.

### Ask before deciding

Raise architectural decisions, scope ambiguity, conflicting requirements, and dependency
conflicts with the developer rather than resolving them unilaterally.
