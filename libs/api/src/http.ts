import { OpenAPIHono, z, type Hook } from '@hono/zod-openapi';
import type { Context, Env } from 'hono';
import type { ErrorResponse } from '@schediochron/core';

/**
 * HTTP error handling for `@schediochron/api`.
 *
 * Everything here produces the single error envelope shipped in the contract
 * (`ErrorResponse = { error, details? }`, see `openapi.yaml` and
 * `@schediochron/core`). There is deliberately no second error shape: the typed
 * helpers below and the request-validation hook all emit this one envelope so
 * every 4xx answer looks the same to clients.
 */

/** The 4xx statuses the contract actually uses (see `openapi.yaml`). */
export type ErrorStatus = 400 | 401 | 403 | 404 | 409;

/**
 * One field-level validation problem. Intentionally minimal: a dotted path to
 * the offending field and a human-readable, schema-authored message. Nothing
 * from the runtime (stack traces, driver errors, SQL) is ever placed here.
 */
export interface ValidationIssue {
  /** Dotted path to the offending field; empty string for the request root. */
  path: string;
  /** Human-readable message, authored by the Zod schema. */
  message: string;
}

/**
 * Emit the `ErrorResponse` envelope with the given status. `details` is omitted
 * entirely when not supplied, matching the contract's optional `details`.
 */
export function errorResponse(
  c: Context,
  status: ErrorStatus,
  error: string,
  details?: unknown,
) {
  const body: ErrorResponse =
    details === undefined ? { error } : { error, details };
  return c.json(body, status);
}

/** 400 — malformed or invalid request. */
export const badRequest = (c: Context, error = 'Bad request', details?: unknown) =>
  errorResponse(c, 400, error, details);

/** 401 — missing or invalid authentication. */
export const unauthorized = (
  c: Context,
  error = 'Unauthorized',
  details?: unknown,
) => errorResponse(c, 401, error, details);

/** 403 — authenticated but not permitted. */
export const forbidden = (c: Context, error = 'Forbidden', details?: unknown) =>
  errorResponse(c, 403, error, details);

/** 404 — resource does not exist. */
export const notFound = (c: Context, error = 'Not found', details?: unknown) =>
  errorResponse(c, 404, error, details);

/** 409 — request conflicts with current state. */
export const conflict = (c: Context, error = 'Conflict', details?: unknown) =>
  errorResponse(c, 409, error, details);

/**
 * Reduce a `ZodError` to the field-level `details` payload. Only the path and
 * the schema-authored message survive; the raw error, its `code`s, and any
 * runtime context are dropped so nothing internal can leak to the client.
 */
export function formatZodIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

/**
 * The validation hook shared by every route. `@hono/zod-openapi` runs it after
 * validating a request against the route's Zod schemas; on failure we answer
 * 400 in the `ErrorResponse` envelope rather than the library default. On
 * success we return nothing, letting the handler run.
 */
export const validationHook: Hook<unknown, Env, string, Response | undefined> = (
  result,
  c,
) => {
  if (!result.success) {
    return badRequest(c, 'Validation failed', formatZodIssues(result.error));
  }
  return undefined;
};

/**
 * Construct an `OpenAPIHono` router pre-wired with {@link validationHook}. Every
 * router in the app — the top-level app and each resource group — is built this
 * way so contract-derived validation and the error envelope apply uniformly as
 * endpoints (#29–#33) land.
 */
export function createRouter(): OpenAPIHono {
  return new OpenAPIHono({ defaultHook: validationHook });
}
