# ADR-005: REST API Contract

**Status**: Accepted  
**Date**: 2026-03-26  
**Issue**: [#17 — define MVP REST API contract (OpenAPI spec)](https://github.com/cyberniinja/schediochron/issues/17)

---

## Context

`@schediochron/api` requires a formal, machine-readable API contract before implementation can
begin. Without a canonical contract, endpoint shapes, error formats, authentication conventions,
and status codes will diverge between the backend implementation and frontend integration.

This ADR defines the design decisions for the REST API contract — versioning strategy,
authentication scheme, error envelope, and endpoint conventions. The full contract is
specified in `openapi.yaml` (OpenAPI 3.1), alongside the API package in `libs/api/`.
Implementers of
`@schediochron/api` and consumers (`@schediochron/react-app`) should derive their work from
that file.

### Inputs

The API contract is derived from the following accepted ADRs:

| ADR                                         | Subject               |
| ------------------------------------------- | --------------------- |
| [ADR-001](./ADR-001-time-entry-model.md)    | Time entry data model |
| [ADR-002](./ADR-002-user-model.md)          | User data model       |
| [ADR-003](./ADR-003-authentication-flow.md) | Authentication flow   |
| [ADR-004](./ADR-004-team-model.md)          | Team data model       |

---

## Decision

### OpenAPI Version

The spec uses **OpenAPI 3.1**. Key differences from 3.0 that affect this spec:

- Nullable fields use `type: ["string", "null"]` syntax (JSON Schema alignment), not
  `nullable: true`.
- `$ref` can be combined with `description` and other keywords without requiring `allOf`.

### Versioning Strategy

No URL version prefix for MVP (`/auth/...`, not `/v1/auth/...`). Rationale:

- The MVP is a pre-1.0, internally consumed contract — no external stability guarantees yet.
- Adding a prefix now complicates all frontend routes and server routing for zero benefit.
- When a breaking change is needed, versioning will be introduced via a new ADR and a URL
  prefix (e.g. `/v2/`) for the new version. The old unversioned paths will be deprecated with
  a sunset header.

### Authentication Scheme

All endpoints except the following require a valid access token in the `Authorization` header
as `Bearer <accessToken>`:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`

The scheme is declared in `openapi.yaml` as:

```yaml
components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

A global `security: [{ BearerAuth: [] }]` applies to all operations. Unauthenticated
endpoints override it with `security: []`.

### Error Response Envelope

All 4xx and 5xx responses use a consistent JSON envelope:

```typescript
{
  error: string;      // human-readable error message
  details?: unknown;  // optional structured detail (e.g. validation errors)
}
```

This is defined once in `components/schemas/ErrorResponse` and referenced throughout the spec.

### Endpoint Conventions

| Convention            | Rule                                                           |
| --------------------- | -------------------------------------------------------------- |
| Path casing           | kebab-case (e.g. `/time-entries`, `/auth/refresh`)             |
| Resource IDs          | Path parameter `:id` (UUID v4); validated at runtime           |
| List responses        | Plain JSON arrays (no pagination wrapper for MVP)              |
| Empty success         | `204 No Content` with no body (logout, delete, password reset) |
| Created resource      | `201 Created` with the created resource as response body       |
| Timestamps            | ISO 8601 UTC strings (e.g. `"2026-03-26T10:00:00Z"`)           |
| Seconds in timestamps | Always zeroed — minute precision (ADR-001)                     |

### Authorisation Summary

| Endpoint group                                   | Who can call                                           |
| ------------------------------------------------ | ------------------------------------------------------ |
| `POST /auth/*`                                   | Anyone (unauthenticated)                               |
| `GET /users`                                     | Admin only                                             |
| `GET /users/:id`                                 | Admin or the user themselves                           |
| `PATCH /users/:id`                               | Admin or the user themselves                           |
| `PATCH /users/:id/password`                      | Admin only                                             |
| `GET /time-entries`                              | Member sees own entries; admin can pass `userId` param |
| `POST /time-entries`, `POST /time-entries/start` | Any authenticated user                                 |
| `POST /time-entries/stop`                        | Any authenticated user (stops their own running entry) |
| `GET/PATCH/DELETE /time-entries/:id`             | Owner of the entry or admin                            |
| `GET/POST /teams`                                | Any authenticated user                                 |
| `GET/PATCH/DELETE /teams/:id`                    | Team admin (for write ops); team member (for read)     |
| `POST/DELETE /teams/:id/members`                 | Team admin                                             |
| `GET /reports/hours`                             | Admin or the user whose data is requested              |

Authorisation rules are documented here for implementer reference. They are not expressible in
OpenAPI 3.1 path definitions and are enforced at the application layer.

---

## Out of Scope (MVP)

The following are explicitly excluded from the MVP contract:

- Self-service password reset via email
- OAuth, SSO, magic-link authentication
- Invite-based team joining
- Bulk operations (bulk create/delete time entries)
- Webhook endpoints
- Pagination (list endpoints return plain arrays)
- Rate limiting headers
- File upload / avatar endpoints

Future versions may introduce these as additions to or amendments of this ADR.

---

## Consequences

- **`@schediochron/api`**: implement all operations defined in `openapi.yaml`. Use this ADR
  for authorisation rules not expressible in the spec.
- **`@schediochron/react-app`**: use `openapi.yaml` for typed client generation or manual
  integration. All request/response shapes are derived from this file.
- **`@schediochron/core`**: TypeScript interfaces for `User`, `TimeEntry`, and `Team` defined
  in ADR-001 through ADR-004 map directly to the schemas in this spec.
- **Future versioning**: when a breaking change is needed, introduce `/v2/` prefix and
  deprecate the unversioned paths. A new ADR or amendment is required at that point.
