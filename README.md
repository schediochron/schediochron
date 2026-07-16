# Schediochron

**Free, open-source, modular, self-hostable time management for any team.**

Teams shouldn't have to pay for time management software. Schediochron provides everything you need to run your own time tracking system — pick only the parts you need, or use a pre-configured starter bundle to get running in minutes.

> 📍 See [ROADMAP.md](ROADMAP.md) for the full vision and planned milestones.
> 📋 Track progress on the [project board →](https://github.com/users/cyberniinja/projects/2)

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
│   ├── schediochron/           # @schediochron/react-app (prototype)
│   └── schediochron-e2e/       # Playwright E2E tests
├── packages/                   # Library packages (added in Phase 1+)
├── docs/
│   └── adr/                    # Architecture Decision Records
├── openapi.yaml                # REST API contract (added in Phase 1)
├── ROADMAP.md                  # Vision and phase breakdown
├── CONTRIBUTING.md             # Contribution guidelines
├── AGENTS.md                   # Rules for AI agents
├── nx.json                     # Nx workspace config
└── tsconfig.base.json          # Shared TypeScript config
```

---

## Development Setup

### Prerequisites

- [Bun](https://bun.sh/) installed
- A FontAwesome Pro token (see `bunfig.toml.example`)

### Setup

```bash
# Copy Bun config and add your FontAwesome token
cp bunfig.toml.example bunfig.toml

# Install dependencies
bun install

# Start the React app dev server (http://localhost:4200)
bun nx serve schediochron
```

### Common Commands

```bash
# Build
bun nx build schediochron

# Run unit/integration tests
bun nx test schediochron

# Run E2E tests
bun nx e2e schediochron-e2e

# Lint
bun nx lint schediochron

# Type check
bun nx typecheck schediochron

# Format
bun prettier --write .
```

Once the monorepo grows in Phase 1+, use `nx run-many` to target all packages:

```bash
bun nx run-many --target=build --all
bun nx run-many --target=test --all
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on issues, branches, commits, code quality, and versioning.

Working with AI agents? [AGENTS.md](AGENTS.md) holds the rules they follow.

---

## License

MIT — free to use, self-host, and modify. See [LICENSE](LICENSE) (coming in Phase 5).
