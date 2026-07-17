import { describe, expect, it } from 'bun:test';
import { createRoute, z } from '@hono/zod-openapi';
import { Hono } from 'hono';
import {
  badRequest,
  conflict,
  createRouter,
  forbidden,
  formatZodIssues,
  notFound,
  unauthorized,
  type ValidationIssue,
} from './http.js';
import { createTeamRequestSchema, hoursReportQuerySchema } from './schemas.js';

type Envelope = { error: string; details?: unknown };

// --- Typed error helpers ---------------------------------------------------

const helpers = [
  { name: 'badRequest', status: 400, fn: badRequest },
  { name: 'unauthorized', status: 401, fn: unauthorized },
  { name: 'forbidden', status: 403, fn: forbidden },
  { name: 'notFound', status: 404, fn: notFound },
  { name: 'conflict', status: 409, fn: conflict },
] as const;

const helperApp = new Hono();
for (const { name, fn } of helpers) {
  helperApp.get(`/${name}`, (c) => fn(c));
  helperApp.get(`/${name}-custom`, (c) => fn(c, 'custom message', { field: 'x' }));
}

describe('error helpers', () => {
  for (const { name, status } of helpers) {
    it(`${name} answers ${status} in the ErrorResponse envelope`, async () => {
      const res = await helperApp.request(`/${name}`);

      expect(res.status).toBe(status);
      expect(res.headers.get('content-type')).toContain('application/json');

      const body = (await res.json()) as Envelope;
      expect(typeof body.error).toBe('string');
      // `details` is omitted entirely when not supplied.
      expect('details' in body).toBe(false);
    });

    it(`${name} carries a custom message and details`, async () => {
      const res = await helperApp.request(`/${name}-custom`);

      expect(res.status).toBe(status);
      const body = (await res.json()) as Envelope;
      expect(body.error).toBe('custom message');
      expect(body.details).toEqual({ field: 'x' });
    });
  }
});

// --- Zod issue formatting --------------------------------------------------

describe('formatZodIssues', () => {
  it('reduces each issue to a path and a schema-authored message only', () => {
    const result = createTeamRequestSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
    if (result.success) return;

    const issues = formatZodIssues(result.error);
    expect(issues.length).toBeGreaterThan(0);
    for (const issue of issues) {
      expect(Object.keys(issue).sort()).toEqual(['message', 'path']);
      expect(typeof issue.path).toBe('string');
      expect(typeof issue.message).toBe('string');
    }
    expect(issues[0]?.path).toBe('name');
  });
});

// --- Request validation wired through the shared hook ----------------------

const okSchema = z.object({ ok: z.boolean() });

const teamRoute = createRoute({
  method: 'post',
  path: '/teams',
  request: {
    body: { content: { 'application/json': { schema: createTeamRequestSchema } } },
  },
  responses: {
    201: { description: 'created', content: { 'application/json': { schema: okSchema } } },
  },
});

const reportRoute = createRoute({
  method: 'get',
  path: '/reports',
  request: { query: hoursReportQuerySchema },
  responses: {
    200: { description: 'ok', content: { 'application/json': { schema: okSchema } } },
  },
});

const validated = createRouter();
validated.openapi(teamRoute, (c) => c.json({ ok: true }, 201));
validated.openapi(reportRoute, (c) => c.json({ ok: true }, 200));

const postTeam = (body: unknown) =>
  validated.request('/teams', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('request validation via the shared hook', () => {
  it('rejects a malformed body with 400 and the ErrorResponse envelope', async () => {
    const res = await postTeam({ name: '' });

    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toContain('application/json');

    const body = (await res.json()) as { error: string; details: ValidationIssue[] };
    expect(body.error).toBe('Validation failed');
    expect(Array.isArray(body.details)).toBe(true);
    expect(body.details.length).toBeGreaterThan(0);
    for (const issue of body.details) {
      expect(Object.keys(issue).sort()).toEqual(['message', 'path']);
    }
  });

  it('reports a missing required field as a field-level detail', async () => {
    const res = await postTeam({});
    expect(res.status).toBe(400);

    const body = (await res.json()) as { details: ValidationIssue[] };
    expect(body.details.some((issue) => issue.path === 'name')).toBe(true);
  });

  it('never leaks internals (stack, driver, SQL) into details', async () => {
    const res = await postTeam({ name: 123 });
    const raw = JSON.stringify(await res.json()).toLowerCase();

    for (const leak of [
      'stack',
      'zoderror',
      'sql',
      'select ',
      'at object',
      'node_modules',
      '.ts:',
    ]) {
      expect(raw).not.toContain(leak);
    }
  });

  it('validates query parameters against the contract too', async () => {
    const res = await validated.request('/reports?range=year');
    expect(res.status).toBe(400);

    const body = (await res.json()) as { error: string; details: ValidationIssue[] };
    expect(body.error).toBe('Validation failed');
    expect(body.details.some((issue) => issue.path === 'range')).toBe(true);
  });

  it('lets a valid request reach the handler', async () => {
    const res = await postTeam({ name: 'Engineering' });
    expect(res.status).toBe(201);

    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});
