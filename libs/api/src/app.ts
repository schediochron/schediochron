import { Hono } from 'hono';

/**
 * The Hono application. Authored as a runtime-agnostic instance built on
 * Web-standard `Request`/`Response` (see ADR-006). Runtime entrypoints such as
 * `main.ts` adapt `app.fetch` to a concrete server.
 */
export const app = new Hono();

app.get('/health', (c) =>
  c.json({ status: 'ok', timestamp: new Date().toISOString() }),
);
