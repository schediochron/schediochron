import type { ErrorResponse } from '@schediochron/core';
import { createRouter } from './http.js';
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
 * Built as an `OpenAPIHono` via {@link createRouter} so request validation
 * derives from the contract Zod schemas and rejects malformed input with the
 * `ErrorResponse` envelope (#71). Routes mirror `openapi.yaml` and currently
 * return stub payloads (#83); authentication lands with the endpoints.
 */
export const app = createRouter();

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
