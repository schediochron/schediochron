import { z } from '@hono/zod-openapi';
import type {
  AddTeamMemberRequest,
  AdminPasswordResetRequest,
  CreateTeamRequest,
  CreateTimeEntryRequest,
  HoursReportQuery,
  ListTimeEntriesQuery,
  LoginRequest,
  LogoutRequest,
  RefreshRequest,
  RegisterRequest,
  StartTimeEntryRequest,
  StopTimeEntryRequest,
  UpdateTeamRequest,
  UpdateTimeEntryRequest,
  UpdateUserRequest,
} from '@schediochron/core';

/**
 * Zod schemas for every request the contract accepts.
 *
 * These are the single source of request validation for `@schediochron/api`.
 * Two guards keep them from drifting from the contract:
 *
 *  - Compile time: the `ContractSchemaAssertions` block below asserts each
 *    schema's inferred type is identical to the matching request type exported
 *    by `@schediochron/core` (which itself mirrors `openapi.yaml`). A field
 *    added, dropped, or retyped on either side fails `tsc`.
 *  - Test time: `schemas.spec.ts` generates OpenAPI schema objects from the
 *    `requestBodySchemas` below and asserts they match the request schemas in
 *    `openapi.yaml`, so constraint drift (lengths, formats, patterns, required
 *    fields) fails the suite.
 *
 * Built with the `z` from `@hono/zod-openapi` so the same schemas can drive both
 * request validation and OpenAPI generation for the endpoints (#29–#33).
 */

// --- Auth ---

export const registerRequestSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(8),
  displayName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
});

export const loginRequestSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export const refreshRequestSchema = z.object({
  refreshToken: z.string(),
});

export const logoutRequestSchema = z.object({
  refreshToken: z.string(),
});

// --- Users ---

export const updateUserRequestSchema = z.object({
  displayName: z.string().max(100).nullable().optional(),
  email: z.string().email().nullable().optional(),
  role: z.enum(['admin', 'member']).optional(),
});

export const adminPasswordResetRequestSchema = z.object({
  newPassword: z.string().min(8),
});

// --- Time entries ---

export const createTimeEntryRequestSchema = z.object({
  startTime: z.string().datetime({ offset: false }),
  endTime: z.string().datetime({ offset: false }),
  note: z.string().max(255).optional(),
});

export const updateTimeEntryRequestSchema = z.object({
  startTime: z.string().datetime({ offset: false }).optional(),
  endTime: z.string().datetime({ offset: false }).nullable().optional(),
  note: z.string().max(255).nullable().optional(),
});

export const startTimeEntryRequestSchema = z.object({
  note: z.string().max(255).optional(),
});

export const stopTimeEntryRequestSchema = z.object({
  note: z.string().max(255).nullable().optional(),
});

export const listTimeEntriesQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  status: z.enum(['running', 'completed']).optional(),
});

// --- Teams ---

export const createTeamRequestSchema = z.object({
  name: z.string().min(1).max(255),
});

export const updateTeamRequestSchema = z.object({
  name: z.string().min(1).max(255),
});

export const addTeamMemberRequestSchema = z.object({
  userId: z.string().uuid(),
});

// --- Reports ---

export const hoursReportQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  range: z.enum(['day', 'week', 'month']).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

/**
 * Named request-body schemas, keyed by their `openapi.yaml` component name.
 * `schemas.spec.ts` iterates this to generate and diff OpenAPI schemas; the
 * endpoints reference the individual exports above.
 */
export const requestBodySchemas = {
  RegisterRequest: registerRequestSchema,
  LoginRequest: loginRequestSchema,
  RefreshRequest: refreshRequestSchema,
  LogoutRequest: logoutRequestSchema,
  UpdateUserRequest: updateUserRequestSchema,
  AdminPasswordResetRequest: adminPasswordResetRequestSchema,
  CreateTimeEntryRequest: createTimeEntryRequestSchema,
  UpdateTimeEntryRequest: updateTimeEntryRequestSchema,
  StartTimeEntryRequest: startTimeEntryRequestSchema,
  StopTimeEntryRequest: stopTimeEntryRequestSchema,
  CreateTeamRequest: createTeamRequestSchema,
  UpdateTeamRequest: updateTeamRequestSchema,
  AddTeamMemberRequest: addTeamMemberRequestSchema,
} as const;

// ---------------------------------------------------------------------------
// Compile-time drift guard: each schema must infer to the matching contract
// type from `@schediochron/core`. These aliases exist only to be type-checked.
// ---------------------------------------------------------------------------

type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
    ? true
    : false;
type Expect<T extends true> = T;

export type ContractSchemaAssertions = [
  Expect<Equal<z.infer<typeof registerRequestSchema>, RegisterRequest>>,
  Expect<Equal<z.infer<typeof loginRequestSchema>, LoginRequest>>,
  Expect<Equal<z.infer<typeof refreshRequestSchema>, RefreshRequest>>,
  Expect<Equal<z.infer<typeof logoutRequestSchema>, LogoutRequest>>,
  Expect<Equal<z.infer<typeof updateUserRequestSchema>, UpdateUserRequest>>,
  Expect<
    Equal<
      z.infer<typeof adminPasswordResetRequestSchema>,
      AdminPasswordResetRequest
    >
  >,
  Expect<
    Equal<z.infer<typeof createTimeEntryRequestSchema>, CreateTimeEntryRequest>
  >,
  Expect<
    Equal<z.infer<typeof updateTimeEntryRequestSchema>, UpdateTimeEntryRequest>
  >,
  Expect<
    Equal<z.infer<typeof startTimeEntryRequestSchema>, StartTimeEntryRequest>
  >,
  Expect<
    Equal<z.infer<typeof stopTimeEntryRequestSchema>, StopTimeEntryRequest>
  >,
  Expect<
    Equal<z.infer<typeof listTimeEntriesQuerySchema>, ListTimeEntriesQuery>
  >,
  Expect<Equal<z.infer<typeof createTeamRequestSchema>, CreateTeamRequest>>,
  Expect<Equal<z.infer<typeof updateTeamRequestSchema>, UpdateTeamRequest>>,
  Expect<Equal<z.infer<typeof addTeamMemberRequestSchema>, AddTeamMemberRequest>>,
  Expect<Equal<z.infer<typeof hoursReportQuerySchema>, HoursReportQuery>>,
];
