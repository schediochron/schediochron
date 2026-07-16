# Schediochron — Agent Rules

Single source of instructions for AI agents working in this repo. There is no mandated workflow:
read the task, do the work, follow the rules below.

## Stack

Nx monorepo, TypeScript, Bun, React 19 + Vite, Vitest, Playwright, ESLint, Prettier.

```
schediochron/
├── apps/
│   ├── react-app/            # @schediochron/react-app — main React app (Vite + SCSS)
│   └── react-app-e2e/        # @schediochron/react-app-e2e — Playwright E2E
├── packages/
│   ├── core/                 # @schediochron/core — domain models and types
│   ├── react-components/     # @schediochron/react-components — shared UI
│   └── api/                  # @schediochron/api — Hono API
├── docs/adr/                 # Architecture Decision Records
├── openapi.yaml              # REST API contract
├── nx.json
└── tsconfig.base.json
```

## Commands

```bash
bun install                        # Install dependencies
bun nx serve react-app             # Dev server (http://localhost:4200)
bun nx build react-app             # Production build
bun nx run-many -t typecheck       # Type check all projects
bun nx run-many -t test            # Unit/integration tests
bun nx run-many -t lint            # ESLint (add --fix to auto-fix)
bun nx e2e react-app-e2e           # E2E tests
bunx prettier --write .            # Format
```

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
- Styles live in separate SCSS module files.
- No `console.error` or `console.warn` in production code.
- Unit/integration tests: Vitest, named `*.spec.ts(x)` or `*.test.ts(x)`, Testing Library for
  components. E2E: Playwright in `apps/react-app-e2e/src/` — test user flows, not implementation
  details.

### Ask before deciding

Raise architectural decisions, scope ambiguity, conflicting requirements, and dependency
conflicts with the developer rather than resolving them unilaterally.
