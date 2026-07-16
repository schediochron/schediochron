import { Hono } from 'hono';
import type { ErrorResponse } from '@schediochron/core';
import { authRoutes } from './routes/auth.js';
import { reportRoutes } from './routes/reports.js';
import { teamRoutes } from './routes/teams.js';
import { timeEntryRoutes } from './routes/time-entries.js';
import { userRoutes } from './routes/users.js';

/**
 * The Hono application. Authored as a runtime-agnostic instance built on
 * Web-standard `Request`/`Response` (see ADR-006). Runtime entrypoints such as
 * `main.ts` adapt `app.fetch` to a concrete server.
 *
 * Routes mirror `openapi.yaml` and currently return stub payloads (#83).
 * Authentication and request validation land in Phase 2 (#71), so for now every
 * endpoint answers as though the caller were authorised.
 */
export const app = new Hono();

app.get('/health', (c) =>
  c.json({ status: 'ok', timestamp: new Date().toISOString() }),
);

app.route('/auth', authRoutes);
app.route('/users', userRoutes);
app.route('/time-entries', timeEntryRoutes);
app.route('/teams', teamRoutes);
app.route('/reports', reportRoutes);

// The contract specifies the ErrorResponse envelope for every 4xx and 5xx, so
// unrouted paths and uncaught throws answer in it too rather than in Hono's
// plain-text defaults.
app.notFound((c) => {
  const body: ErrorResponse = { error: 'Not found' };
  return c.json(body, 404);
});

app.onError((_err, c) => {
  const body: ErrorResponse = { error: 'Internal server error' };
  return c.json(body, 500);
});
