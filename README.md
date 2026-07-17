# Schediochron

**Free, open-source, modular, self-hostable time management for any team.**

Teams shouldn't have to pay for time management software. Schediochron provides everything you need to run your own time tracking system — pick only the parts you need, or use a pre-configured starter bundle to get running in minutes.

> 📍 See [ROADMAP.md](ROADMAP.md) for the full vision and planned milestones.
> 📋 Track progress on the [project board →](https://github.com/orgs/schediochron/projects/1)

---

## Current Status

**Early prototype (v0.1.x).** The current codebase is a React UI prototype demonstrating the calendar-based time tracking interface. Active development is underway toward a full modular platform — see [ROADMAP.md](ROADMAP.md) for what's coming.

---

## What We're Building

Schediochron is composed of independently usable packages:

| Package                          | Purpose                                                   | Status       |
| -------------------------------- | --------------------------------------------------------- | ------------ |
| `@schediochron/core`             | Data models, repository interfaces, and validation logic  | 🔜 Phase 1   |
| `@schediochron/sql`              | PostgreSQL database adapter                               | 🔜 Phase 2   |
| `@schediochron/mongo`            | MongoDB database adapter                                  | 🔜 Phase 4   |
| `@schediochron/api`              | REST API server                                           | 🔜 Phase 2   |
| `@schediochron/config`           | Configuration schema and loader for composing modules     | 🔜 Phase 3   |
| `@schediochron/react-components` | Reusable React UI components (calendar, time entry, etc.) | 🔜 Phase 1   |
| `@schediochron/react-app`        | Full React frontend application                           | 🚧 Prototype |
| `@schediochron/vue-components`   | Reusable Vue UI components                                | 🔜 Phase 4   |
| `@schediochron/vue-app`          | Full Vue frontend application                             | 🔜 Phase 4   |
| `@schediochron/cli`              | Command-line interface                                    | 🔜 Phase 4   |
| `@schediochron/mcp`              | MCP server for AI assistant integration                   | 🔜 Phase 4   |
| `@schediochron/starter-pg`       | Pre-configured bundle: PostgreSQL + API + React           | 🔜 Phase 3   |
| `@schediochron/starter-mongo`    | Pre-configured bundle: MongoDB + API + React              | 🔜 Phase 4   |

**Starter bundles** let you run the full stack with a single command. They're organized by backend — choose PostgreSQL or MongoDB, the frontend is included and swappable.

---

## Repository Structure

```
schediochron/
├── apps/
│   └── react-app/              # @schediochron/react-app — React app (e2e/ holds its E2E tests)
├── libs/
│   ├── core/                   # @schediochron/core — domain models
│   ├── react-components/       # @schediochron/react-components — shared UI
│   └── api/                    # @schediochron/api — Hono API + openapi.yaml
├── docs/
│   └── adr/                    # Architecture Decision Records
├── ROADMAP.md                  # Vision and phase breakdown
├── CONTRIBUTING.md             # Contribution guidelines
├── AGENTS.md                   # Rules for AI agents
└── tsconfig.base.json          # Shared TypeScript config
```

The repo is a plain [Bun workspaces](https://bun.com/docs/install/workspaces) monorepo — every
app and lib is a self-contained package that owns its scripts, and the root scripts fan out
with `bun run --filter`. Bun does the bundling, the dev server, and the testing.

---

## Development Setup

### Prerequisites

- [Bun](https://bun.sh/) installed

### Setup

```bash
# Install dependencies
bun install

# Start the React app dev server (http://localhost:4200)
bun run dev
```

### Full stack with Docker Compose

To run the whole stack — PostgreSQL, the API, and the web dev server — with one
command:

```bash
cp .env.example .env        # then set FONTAWESOME_TOKEN (see CONTRIBUTING.md)
docker compose up
```

This starts PostgreSQL, applies the database migrations automatically, then
brings up the API (http://localhost:3000) and the React dev server
(http://localhost:4200). The repository is bind-mounted, so edits hot-reload.
Stop with `docker compose down`, or `docker compose down -v` to also drop the
database volume.

### Common Commands

```bash
bun run build      # Build all projects
bun run test       # Unit/integration tests
bun run e2e        # E2E tests (run `bun run build` first)
bun run lint       # Lint
bun run typecheck  # Type check
bun run format     # Format
```

Target a single project with `--filter`:

```bash
bun run --filter @schediochron/core test
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on issues, branches, commits, code quality, and versioning.

Working with AI agents? [AGENTS.md](AGENTS.md) holds the rules they follow.

---

## License

MIT — free to use, self-host, and modify. See [LICENSE](LICENSE) (coming in Phase 5).
