# Contributing to Schediochron

Thank you for contributing! This guide covers the conventions and standards for working on this project.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) installed

### Setup

```bash
bun install
bun run dev
```

### Secrets

This project uses FontAwesome Pro, which requires an auth token. Secrets are managed with [direnv](https://direnv.net/), which automatically loads per-project environment variables without polluting your shell profile.

1. Install direnv and add the hook to your shell:

   ```bash
   brew install direnv
   echo 'eval "$(direnv hook zsh)"' >> ~/.zshrc  # or ~/.bashrc
   source ~/.zshrc
   ```

2. Copy `.envrc.example` to `.envrc` and fill in your token:

   ```bash
   cp .envrc.example .envrc
   # edit .envrc and add your FontAwesome token
   direnv allow
   ```

3. Install dependencies:
   ```bash
   bun install
   ```

## Issues

### Creating Issues

Every task should have a GitHub issue. Issues must include a **type label** (`feature`, `bug`, `chore`, `refactoring`).

#### Feature Request

```markdown
## Description

A clear and concise description of the feature.

## Motivation

Why is this feature needed? What problem does it solve?

## Proposed Solution

How should this feature work?

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Additional Context

Any mockups, screenshots, or references.
```

#### Bug Report

```markdown
## Description

A clear and concise description of the bug.

## Steps to Reproduce

1. Go to '...'
2. Click on '...'
3. See error

## Expected Behaviour

What should happen.

## Actual Behaviour

What actually happens.

## Environment

- Browser:
- OS:

## Additional Context

Screenshots, error logs, or stack traces.
```

#### Chore / Refactoring

```markdown
## Description

A clear and concise description of the task.

## Motivation

Why is this change needed?

## Scope

What is affected by this change?

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
```

### Issue Labels

| Label         | Usage                              | Colour |
| ------------- | ---------------------------------- | ------ |
| `feature`     | New functionality                  | Green  |
| `bug`         | Bug fixes                          | Red    |
| `chore`       | Maintenance, dependencies, tooling | Yellow |
| `refactoring` | Code restructuring                 | Blue   |

## Branches

### Naming Convention

```
{type}/{issueNr}-{issueName}
```

| Type          | Usage                              | Example                            |
| ------------- | ---------------------------------- | ---------------------------------- |
| `feature`     | New functionality                  | `feature/42-add-profile-component` |
| `bug`         | Bug fixes                          | `bug/17-fix-calendar-rendering`    |
| `chore`       | Maintenance, dependencies, tooling | `chore/88-update-dependencies`     |
| `refactoring` | Code restructuring                 | `refactoring/23-extract-layout`    |

## Commits

### Message Format

```
{type}(#{issueNr}): description
```

Types: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `style`

Example: `feat(#42): add profile component`

## Releases

There is no release automation — the project is too early for it. Release notes are written by
agents when a release is actually cut.

## Code Quality

All contributions must pass before merging:

```bash
bun run test          # Unit/integration tests
bun run lint          # Linting
bun run typecheck     # Type checking
bun run format:check  # Formatting
```

### Code Standards

- TypeScript strict mode is enforced
- Use functional React components (no class components)
- Use hooks for state and side effects
- Props must be typed with TypeScript interfaces
- Styles in separate SCSS module files
- No `console.error` or `console.warn` in production code

## AI Agents

[AGENTS.md](AGENTS.md) is the single set of instructions for AI agents in this repo — stack,
commands, and the rules they must follow. There is no prescribed workflow; use your tool however
you like, as long as the rules hold.

Tool-specific config directories (`.claude/`, `.github/agents/`) are gitignored — add your own
locally.
