# ADR-007: Release and Publishing

**Status**: Accepted  
**Date**: 2026-07-16  
**Issue**: [#69 — define and automate the public release process](https://github.com/schediochron/schediochron/issues/69)

---

## Context

Schediochron is built to be consumed as independently installable packages — that modularity is
the product, not an implementation detail. So how versions are cut, what they mean together, and
where they are distributed are decisions the architecture depends on.

Three things forced the question now:

- **Release automation was removed.** The repo ran [Release Please](https://github.com/googleapis/release-please),
  which cut `schediochron@v0.1.0` and `v0.1.1` in March 2026 and then produced nothing for four
  months while substantial work landed. It was configured to watch a single package
  (`apps/react-app`), so `core`, `react-components` and `api` were never releasable through it,
  and it derives versions from [Conventional Commits](https://www.conventionalcommits.org), which
  this project's commit convention does not follow. It ran green on every merge and did nothing.
- **Nothing is published yet.** Every package is `private: true`. Inside the workspace,
  `workspace:^` resolves internal dependencies, and the starter bundles will live in this repo
  too — so no registry is needed until something outside the repo installs a package, which is a
  Phase 5 concern.
- **Releases are wanted now, for history.** Phase completions should be tagged and downloadable
  as a record of how the project evolved. That need is independent of distribution.

## Decision

### 1. A release and a publish are separate things

A **release** is a git tag plus a GitHub Release: the historical record. A **publish** pushes
tarballs to a registry: distribution. They are decoupled, and only the first is needed today.

Tag phase completions as `vX.Y.Z` and title the release for the phase it closes (e.g.
`v0.2.0 — Phase 1: Architecture Foundation`). GitHub generates the source archives for every tag
automatically; nothing needs building or uploading for the snapshot to exist permanently.

Tags are versions and carry no other meaning — the phase belongs in the release title. This
supersedes the `schediochron@vX.Y.Z` tag format, which was an artifact of Release Please's
`include-component-in-tag` setting for a single watched package.

### 2. Publish to npm, not GitHub Packages, when the time comes

GitHub Packages was considered as an interim registry and rejected on two counts:

- **The scope must equal the owning account**, so packages would publish as `@cyberniinja/*` —
  or, after the org move, `@schediochron/*` only because the GitHub org happens to share the
  name. Publishing under a name we do not intend to keep is not a rehearsal of anything.
- **Installing a public package requires a token.** GitHub's docs: _"You need an access token to
  publish, install, and delete private, internal, and public packages."_ Requiring every consumer
  to hold a PAT and configure `.npmrc` contradicts the project's central promise of frictionless
  self-hosting.

npm is public, anonymous to install, and is the name we actually want. The `@schediochron` org is
reserved there. (This applies to the npm registry only: `ghcr.io` allows anonymous pulls, so
GitHub remains the sensible home for the Phase 5 Docker images.)

### 3. Lockstep versioning across `@schediochron/*`

All packages share one version. A release means "everything at 1.3.0 works together".

The alternative — independent per-package versions — is more honest about what changed, but it
produces a compatibility matrix that someone has to maintain and consumers have to read. Since
starter bundles compose many packages at once, a single family version turns compatibility into
a fact rather than documentation. The earlier releases were already single-versioned.

### 4. No release tooling until publishing exists; then Changesets if warranted

Release Please was removed because it was ceremony without a product. Adopting a replacement now
would repeat that mistake, so releases are cut by hand: bump, write notes, tag, publish the
GitHub Release.

When tooling is warranted, use [Changesets](https://github.com/changesets/changesets) rather than
a commit-parsing tool. This follows directly from the commit convention: Changesets ignores commit
history and takes a per-PR note instead, which also means release notes get written while the
context is fresh and are reviewed in the diff — rather than reconstructed from commit archaeology
at release time. Verify its Bun compatibility before adopting it.

## Consequences

The publish cycle, once npm is live, is today's release ritual plus one step:

1. Bump every `@schediochron/*` to the same version
2. Write the notes into `CHANGELOG.md`
3. PR → merge → tag `vX.Y.Z`
4. GitHub Release from the tag (source archives automatic)
5. **New:** CI publishes each package on the tag

Starting the tag-and-release habit now is therefore not a detour — it is the release process
minus its last line.

**Already in place:** `bun publish` rewrites `workspace:^` to a real caret range on the way out
(same rewriting `bun pm pack` performs), so internal dependencies need no special handling at
publish time; each lib's `files` allowlist already controls its payload.

**Prerequisites for the first publish:**

- Remove `private: true` from the packages to be published
- Add `"publishConfig": { "access": "public" }` — npm's docs: _"Scoped packages are private by
  default; you must pass a command-line flag when publishing to make them public"_
- Add a `repository` field per package (npm links it, and provenance attests against it)
- Reach `1.0.0` first if deduplication matters: caret does not widen below 1.0, so `^0.0.1`
  resolves to exactly `0.0.1` and consumers on different patches get duplicate copies
- Decide provenance. `bun publish` has no `--provenance` flag, so npm provenance via GitHub OIDC
  would make that job call `npm publish --provenance` instead. Nothing needs deciding until the
  workflow is written; it is not a one-way door.

**Follow-up:** #69's acceptance criteria still assume Release Please generates changelogs and
version bumps, and need rewriting against this ADR.
