import { describe, expect, it } from 'bun:test';
import { app } from './app.js';

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await app.request('/health');

    expect(res.status).toBe(200);

    const body = (await res.json()) as { status: string; timestamp: string };
    expect(body.status).toBe('ok');
    expect(typeof body.timestamp).toBe('string');
  });
});

/**
 * Every operation in `openapi.yaml`, with the success status it documents.
 * A route that is missing, mounted on the wrong path, or bound to the wrong
 * method fails here rather than in the per-resource shape specs.
 */
const operations = [
  { id: 'registerUser', method: 'POST', path: '/auth/register', status: 201 },
  { id: 'loginUser', method: 'POST', path: '/auth/login', status: 200 },
  { id: 'refreshToken', method: 'POST', path: '/auth/refresh', status: 200 },
  { id: 'logoutUser', method: 'POST', path: '/auth/logout', status: 204 },

  { id: 'listUsers', method: 'GET', path: '/users', status: 200 },
  { id: 'getUser', method: 'GET', path: '/users/u-1', status: 200 },
  { id: 'updateUser', method: 'PATCH', path: '/users/u-1', status: 200 },
  {
    id: 'adminResetPassword',
    method: 'PATCH',
    path: '/users/u-1/password',
    status: 204,
  },

  { id: 'listTimeEntries', method: 'GET', path: '/time-entries', status: 200 },
  { id: 'createTimeEntry', method: 'POST', path: '/time-entries', status: 201 },
  {
    id: 'startTimeEntry',
    method: 'POST',
    path: '/time-entries/start',
    status: 201,
  },
  {
    id: 'stopTimeEntry',
    method: 'POST',
    path: '/time-entries/stop',
    status: 200,
  },
  { id: 'getTimeEntry', method: 'GET', path: '/time-entries/e-1', status: 200 },
  {
    id: 'updateTimeEntry',
    method: 'PATCH',
    path: '/time-entries/e-1',
    status: 200,
  },
  {
    id: 'deleteTimeEntry',
    method: 'DELETE',
    path: '/time-entries/e-1',
    status: 204,
  },

  { id: 'listTeams', method: 'GET', path: '/teams', status: 200 },
  { id: 'createTeam', method: 'POST', path: '/teams', status: 201 },
  { id: 'getTeam', method: 'GET', path: '/teams/t-1', status: 200 },
  { id: 'updateTeam', method: 'PATCH', path: '/teams/t-1', status: 200 },
  { id: 'deleteTeam', method: 'DELETE', path: '/teams/t-1', status: 204 },
  {
    id: 'addTeamMember',
    method: 'POST',
    path: '/teams/t-1/members',
    status: 200,
  },
  {
    id: 'removeTeamMember',
    method: 'DELETE',
    path: '/teams/t-1/members/u-2',
    status: 200,
  },

  // getHoursReport is omitted here: it is a real, auth-protected endpoint (#33),
  // so a tokenless smoke request cannot reach its documented success status. Its
  // routing, status codes, aggregation, and authorisation are covered end-to-end
  // in routes/reports.spec.ts.
] as const;

describe('openapi.yaml operations', () => {
  it('covers every documented operation', () => {
    // Guards against an endpoint being dropped from the table along with its
    // route. getHoursReport is covered in routes/reports.spec.ts.
    expect(operations).toHaveLength(22);
  });

  for (const { id, method, path, status } of operations) {
    it(`${id}: ${method} ${path} → ${status}`, async () => {
      const res = await app.request(path, { method });
      expect(res.status).toBe(status);
    });
  }

  for (const { id, method, path, status } of operations) {
    if (status === 204) {
      it(`${id}: ${method} ${path} sends no body`, async () => {
        const res = await app.request(path, { method });
        expect(await res.text()).toBe('');
      });
    } else {
      it(`${id}: ${method} ${path} sends JSON`, async () => {
        const res = await app.request(path, { method });
        expect(res.headers.get('content-type')).toContain('application/json');
      });
    }
  }
});

describe('unrouted requests', () => {
  it('returns the ErrorResponse envelope for an unknown path', async () => {
    const res = await app.request('/nope');

    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');

    const body = (await res.json()) as { error: string };
    expect(typeof body.error).toBe('string');
  });

  it('returns 404 for a method the path does not define', async () => {
    const res = await app.request('/auth/register', { method: 'DELETE' });

    expect(res.status).toBe(404);
  });
});
