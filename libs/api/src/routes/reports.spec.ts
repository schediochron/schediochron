import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import type { TimeEntry, TimeEntryStatus } from '@schediochron/core';
import { validateTimeEntry } from '@schediochron/core';
import { app } from '../app.js';
import { setRepositories, type Repositories } from '../repositories.js';
import { signAccessToken } from '../auth/tokens.js';

const SECRET = 'reports-test-secret';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';

// requireAuth verifies with the env secret, so tokens the tests sign must use
// the same one. Pin it for this file and restore afterwards.
let savedSecret: string | undefined;
beforeAll(() => {
  savedSecret = process.env.ACCESS_TOKEN_SECRET;
  process.env.ACCESS_TOKEN_SECRET = SECRET;
});
afterAll(() => {
  if (savedSecret === undefined) delete process.env.ACCESS_TOKEN_SECRET;
  else process.env.ACCESS_TOKEN_SECRET = savedSecret;
});

afterEach(() => {
  // Never leave an override in place for other suites.
  setRepositories(undefined);
});

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** A completed entry with valid, contract-shaped fields. */
function completed(id: string, startTime: string, endTime: string): TimeEntry {
  return {
    id,
    userId: USER_ID,
    startTime,
    endTime,
    status: 'completed',
    note: null,
    createdAt: startTime,
    updatedAt: endTime,
  };
}

// Two entries on 2026-03-10 (150 + 60 = 210 min) and one on 2026-03-11 (45 min).
const ENTRIES: TimeEntry[] = [
  completed(
    '33333333-3333-4333-8333-333333333331',
    '2026-03-10T09:00:00Z',
    '2026-03-10T11:30:00Z',
  ),
  completed(
    '33333333-3333-4333-8333-333333333332',
    '2026-03-10T13:00:00Z',
    '2026-03-10T14:00:00Z',
  ),
  completed(
    '33333333-3333-4333-8333-333333333333',
    '2026-03-11T08:00:00Z',
    '2026-03-11T08:45:00Z',
  ),
];

interface FindFilter {
  userId?: string;
  status?: TimeEntryStatus;
  from?: string;
  to?: string;
}

/**
 * Installs an in-memory `timeEntries` repository that returns `entries` for any
 * `find`, recording the filter it was called with. The other repositories and
 * CRUD methods are absent — the reporting handler only reaches for
 * `timeEntries.find`.
 */
function installRepositories(entries: TimeEntry[]): {
  lastFilter?: FindFilter;
} {
  const calls: { lastFilter?: FindFilter } = {};
  const timeEntries = {
    find(filter: FindFilter): Promise<TimeEntry[]> {
      calls.lastFilter = filter;
      return Promise.resolve(entries);
    },
  };
  setRepositories({ timeEntries } as unknown as Repositories);
  return calls;
}

async function tokenFor(id: string, role: 'admin' | 'member'): Promise<string> {
  return signAccessToken({ id, username: 'ada', role }, { secret: SECRET });
}

describe('GET /reports/hours', () => {
  it('401s without an access token', async () => {
    installRepositories(ENTRIES);
    const res = await app.request('/reports/hours');
    expect(res.status).toBe(401);
  });

  it('400s on an invalid query parameter, in the error envelope', async () => {
    installRepositories(ENTRIES);
    const token = await tokenFor(USER_ID, 'member');
    const res = await app.request('/reports/hours?from=not-a-date', {
      headers: bearer(token),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; details?: unknown };
    expect(body.error).toBe('Validation failed');
    expect(Array.isArray(body.details)).toBe(true);
  });

  it('buckets completed entries by day and sums each day, ascending', async () => {
    installRepositories(ENTRIES);
    const token = await tokenFor(USER_ID, 'member');
    const res = await app.request('/reports/hours', { headers: bearer(token) });
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      date: string;
      totalMinutes: number;
      entries: TimeEntry[];
    }[];

    expect(body.map((d) => d.date)).toEqual(['2026-03-10', '2026-03-11']);

    const [day1, day2] = body;
    // 09:00→11:30 (150) + 13:00→14:00 (60) = 210
    expect(day1.totalMinutes).toBe(210);
    expect(day1.entries).toHaveLength(2);
    // 08:00→08:45 = 45
    expect(day2.totalMinutes).toBe(45);
    expect(day2.entries).toHaveLength(1);

    for (const day of body) {
      for (const entry of day.entries) {
        expect(validateTimeEntry(entry).success).toBe(true);
      }
    }
  });

  it('requests only completed entries for the authenticated user', async () => {
    const calls = installRepositories(ENTRIES);
    const token = await tokenFor(USER_ID, 'member');
    await app.request('/reports/hours', { headers: bearer(token) });

    expect(calls.lastFilter?.userId).toBe(USER_ID);
    expect(calls.lastFilter?.status).toBe('completed');
  });

  it('passes an explicit from/to window through to the repository', async () => {
    const calls = installRepositories(ENTRIES);
    const token = await tokenFor(USER_ID, 'member');
    await app.request('/reports/hours?from=2026-03-01&to=2026-03-31', {
      headers: bearer(token),
    });

    expect(calls.lastFilter?.from).toBe('2026-03-01');
    expect(calls.lastFilter?.to).toBe('2026-03-31');
  });

  it('resolves the range shorthand to a window ending today', async () => {
    const calls = installRepositories(ENTRIES);
    const token = await tokenFor(USER_ID, 'member');
    await app.request('/reports/hours?range=day', { headers: bearer(token) });

    const today = new Date().toISOString().slice(0, 10);
    // range=day is a single-day window: from and to are both today.
    expect(calls.lastFilter?.from).toBe(today);
    expect(calls.lastFilter?.to).toBe(today);
  });

  it('403s a member reporting on another user', async () => {
    installRepositories(ENTRIES);
    const token = await tokenFor(USER_ID, 'member');
    const res = await app.request(`/reports/hours?userId=${OTHER_USER_ID}`, {
      headers: bearer(token),
    });
    expect(res.status).toBe(403);
  });

  it('lets an admin report on another user', async () => {
    const calls = installRepositories(ENTRIES);
    const token = await tokenFor(USER_ID, 'admin');
    const res = await app.request(`/reports/hours?userId=${OTHER_USER_ID}`, {
      headers: bearer(token),
    });
    expect(res.status).toBe(200);
    expect(calls.lastFilter?.userId).toBe(OTHER_USER_ID);
  });
});
