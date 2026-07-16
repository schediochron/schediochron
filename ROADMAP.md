# Schediochron Roadmap

> **Track progress on the [Schediochron Roadmap project board →](https://github.com/users/cyberniinja/projects/2)**

---

## Vision

Schediochron is a **free, open-source, modular, self-hostable time management platform** for any team.

The problem we're solving: teams are paying a lot of money for time management software they could run themselves for free. Schediochron aims to make setting up a complete time management system as easy as possible — no vendor lock-in, no subscriptions, no compromises.

**Guiding principles:**

- **Modular by design** — pick only the parts you need
- **Open source (MIT)** — free forever
- **Developer-first** — easy to self-host, integrate, and extend
- **Accessible to all** — quickstart bundles for non-technical teams (coming later)

---

## Module Architecture

Schediochron is composed of independently usable packages:

| Package                          | Purpose                                                                                                                                      |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `@schediochron/core`             | Baseline interfaces, data models, and core business logic                                                                                    |
| `@schediochron/sql`              | PostgreSQL (and SQL-compatible) database adapter                                                                                             |
| `@schediochron/mongo`            | MongoDB database adapter                                                                                                                     |
| `@schediochron/react-components` | React component library — reusable UI components (calendar, time entry, etc.) for use in any React application                               |
| `@schediochron/react-app`        | Full React frontend application — a ready-to-run web UI built on `@schediochron/react-components`, requiring `@schediochron/api` to function |
| `@schediochron/vue-components`   | Vue component library — equivalent of `react-components` for Vue applications                                                                |
| `@schediochron/vue-app`          | Full Vue frontend application                                                                                                                |
| `@schediochron/api`              | REST API server — the backend all frontend applications communicate with                                                                     |
| `@schediochron/cli`              | Command-line interface                                                                                                                       |
| `@schediochron/mcp`              | MCP (Model Context Protocol) server                                                                                                          |
| `@schediochron/config`           | Configuration schema, validation, and loader for composing modules                                                                           |

**Starter bundles** are organized by backend combination (not frontend tech). Each ships with a default React frontend, swappable via config:

| Starter                       | Stack                 |
| ----------------------------- | --------------------- |
| `@schediochron/starter-pg`    | PostgreSQL + REST API |
| `@schediochron/starter-mongo` | MongoDB + REST API    |

---

## Audience

- **Primary (now):** Developers and technical teams who want to self-host a time management system
- **Future:** Non-technical teams via pre-built quickstart bundles and hosted guides

---

## Phases

### Phase 1: Architecture Foundation

Establish the modular monorepo structure that everything else builds on.

- Restructure monorepo around the package architecture above
- Extract `@schediochron/core` — shared data models and interfaces
- Refactor the current React prototype into `@schediochron/react-components` (component library) and `@schediochron/react-app` (full application)

### Phase 2: First Stack

Implement the first complete technology stack: **React + PostgreSQL + REST API**.

- `@schediochron/sql` — PostgreSQL adapter implementing `@schediochron/core` interfaces
- `@schediochron/api` — REST API server
- Wire `@schediochron/react-app` + `@schediochron/api` + `@schediochron/sql` into a working, functional time management system

### Phase 3: Configuration & Composition

Define how Schediochron modules are composed into a complete system.

- Design and implement the configuration concept
- Refactor existing packages to consume `@schediochron/config`
- Ship the first full application bundle (`@schediochron/starter-pg`)
- Document how to assemble a custom stack from individual packages

### Phase 4: Ecosystem Expansion

Expand the ecosystem beyond the initial reference stack.

- `@schediochron/mongo` — MongoDB adapter
- `@schediochron/starter-mongo` — MongoDB starter bundle
- `@schediochron/cli` — CLI for managing time entries and system admin
- `@schediochron/mcp` — MCP server for AI tooling integration
- `@schediochron/vue-components` + `@schediochron/vue-app` — Vue equivalents

### Phase 5: General Availability

Production-ready release for teams of all sizes.

- Pre-configured Docker images and quickstart bundles
- Full documentation and onboarding guides for technical and non-technical users
- Stable public API with versioning guarantees
- Security hardening review
- Accessibility compliance
- Project landing page (GitHub Pages)

### Phase 6: Community & Growth

Make Schediochron discoverable and easy to adopt.

- Full documentation site (guides, API reference, tutorials)
- Interactive demo or playground
- SEO, social presence, and developer community listings
- Community channels and contribution onboarding

---

## Current State

**Version:** 0.1.x (prototype)

The monorepo is structured around the module architecture above. `@schediochron/core` holds the data models and repository interfaces; the React prototype has been split into `@schediochron/react-components` (the reusable calendar and layout components) and `@schediochron/react-app` (the web UI built on them); and `@schediochron/api` is scaffolded on Hono, serving a health check against the REST contract in `libs/api/openapi.yaml`.

Phase 1 finishes by stubbing out the API's routes from that contract, then running the validation gate. Persistence and real request handling arrive in Phase 2, when `@schediochron/sql` implements the `core` repository interfaces and the API is wired to it.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for how to get involved.
Issues and feature requests are tracked on [GitHub Issues](https://github.com/schediochron/schediochron/issues).
The full roadmap is maintained on the [project board](https://github.com/users/cyberniinja/projects/2).
