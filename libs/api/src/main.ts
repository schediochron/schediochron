import { app } from './app.js';

const port = Number(process.env.PORT ?? 3000);

// Bun picks up a default export exposing `fetch` and serves it automatically.
// This is the only Bun-specific glue; the application itself (app.ts) is
// runtime-agnostic (see ADR-006).
export default {
  port,
  fetch: app.fetch,
};
