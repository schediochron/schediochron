import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import type { TimeEntry, TimeEntryRepository } from '@schediochron/core';
import { validateTimeEntry } from '@schediochron/core';
import { RunningEntryExistsError } from '@schediochron/sql';
import { app } from '../app.js';
import type { AccessTokenSubject } from '../auth/tokens.js';
import { signAccessToken } from '../auth/tokens.js';
import type { Repositories } from '../repositories.js';
import { setRepositories } from '../repositories.js';

// A signing secret is required before any token can be minted or verified; the
// value is irrelevant as long as signing and verification share it.
process.env['ACCESS_TOKEN_SECRET'] = 'time-entry-endpoint-test-secret';

/**
 * In-memory {@link TimeEntryRepository}. Mirrors the two invariants the real
 * PostgreSQL repository enforces in the database: one running entry per user
 * (raising {@link RunningEntryExistsError}) and update-of-missing being an error.
 * The overlap rule lives in the handler, so it is deliberately not modelled here.
 */
class FakeTimeEntryRepository implements TimeEntryRepository {
  private readonly store = new Map<string, TimeEntry>();

  seed(entry: TimeEntry): void {
    this.store.set(entry.id, { ...entry });
  }

  async findById(id: string): Promise<TimeEntry | null> {
    return this.store.get(id) ?? null;
  }

  async findAll(): Promise<TimeEntry[]> {
    return [...this.store.values()];
  }

  async create(item: TimeEntry): Promise<TimeEntry> {
    if (item.status === 'running') {
      this.assertNoOtherRunning(item.userId);
    }
    this.store.set(item.id, { ...item });
    return { ...item };
  }

  async update(item: TimeEntry): Promise<TimeEntry> {
    if (!this.store.has(item.id)) {
      throw new Error(`TimeEntry ${item.id} not found`);
    }
    if (item.status === 'running') {
      this.assertNoOtherRunning(item.userId, item.id);
    }
    this.store.set(item.id, { ...item });
    return { ...item };
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async findRunning(userId: string): Promise<TimeEntry | null> {
    for (const entry of this.store.values()) {
      if (entry.userId === userId && entry.status === 'running') {
        return { ...entry };
      }
    }
    return null;
  }

  async find(filter: {
    userId?: string;
    status?: 'running' | 'completed';
    from?: string;
    to?: string;
  }): Promise<TimeEntry[]> {
    return [...this.store.values()].filter(
      (entry) =>
        (filter.userId === undefined || entry.userId === filter.userId) &&
        (filter.status === undefined || entry.status === filter.status) &&
        (filter.from === undefined || entry.startTime >= filter.from) &&
        (filter.to === undefined || entry.startTime <= filter.to),
    );
  }

  private assertNoOtherRunning(userId: string, exceptId?: string): void {
    for (const entry of this.store.values()) {
      if (
        entry.userId === userId &&
        entry.status === 'running' &&
        entry.id !== exceptId
      ) {
        throw new RunningEntryExistsError(userId);
      }
    }
  }
}

const member: AccessTokenSubject = {
  id: '11111111-1111-4111-8111-111111111111',
  username: 'ada',
  role: 'member',
};
const other: AccessTokenSubject = {
  id: '22222222-2222-4222-8222-222222222222',
  username: 'bob',
  role: 'member',
};
const admin: AccessTokenSubject = {
  id: '33333333-3333-4333-8333-333333333333',
  username: 'root',
  role: 'admin',
};

let repo: FakeTimeEntryRepository;

beforeEach(() => {
  repo = new FakeTimeEntryRepository();
  setRepositories({ timeEntries: repo } as unknown as Repositories);
});

afterAll(() => {
  setRepositories(undefined);
});

async function auth(user: AccessTokenSubject): Promise<Record<string, string>> {
  return {
    Authorization: `Bearer ${await signAccessToken(user)}`,
    'Content-Type': 'application/json',
  };
}

function completedEntry(
  userId: string,
  startTime: string,
  endTime: string,
  overrides: Partial<TimeEntry> = {},
): TimeEntry {
  return {
    id: crypto.randomUUID(),
    userId,
    startTime,
    endTime,
    status: 'completed',
    note: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function runningEntry(
  userId: string,
  startTime: string,
  overrides: Partial<TimeEntry> = {},
): TimeEntry {
  return {
    id: crypto.randomUUID(),
    userId,
    startTime,
    endTime: null,
    status: 'running',
    note: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('authentication', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const res = await app.request('/time-entries');
    expect(res.status).toBe(401);
  });
});

describe('GET /time-entries', () => {
  it("returns only the caller's own entries", async () => {
    repo.seed(
      completedEntry(member.id, '2026-01-05T09:00:00Z', '2026-01-05T10:00:00Z'),
    );
    repo.seed(
      completedEntry(member.id, '2026-01-05T11:00:00Z', '2026-01-05T12:00:00Z'),
    );
    repo.seed(
      completedEntry(other.id, '2026-01-05T09:00:00Z', '2026-01-05T10:00:00Z'),
    );

    const res = await app.request('/time-entries', {
      headers: await auth(member),
    });
    const body = (await res.json()) as TimeEntry[];

    expect(res.status).toBe(200);
    expect(body).toHaveLength(2);
    for (const entry of body) {
      expect(entry.userId).toBe(member.id);
      expect(validateTimeEntry(entry).success).toBe(true);
    }
  });

  it('filters by status', async () => {
    repo.seed(
      completedEntry(member.id, '2026-01-05T09:00:00Z', '2026-01-05T10:00:00Z'),
    );
    repo.seed(runningEntry(member.id, '2026-01-05T11:00:00Z'));

    const res = await app.request('/time-entries?status=running', {
      headers: await auth(member),
    });
    const body = (await res.json()) as TimeEntry[];

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0]?.status).toBe('running');
  });

  it("forbids a non-admin from listing another user's entries", async () => {
    const res = await app.request(`/time-entries?userId=${other.id}`, {
      headers: await auth(member),
    });
    expect(res.status).toBe(403);
  });

  it("lets an admin list another user's entries", async () => {
    repo.seed(
      completedEntry(other.id, '2026-01-05T09:00:00Z', '2026-01-05T10:00:00Z'),
    );

    const res = await app.request(`/time-entries?userId=${other.id}`, {
      headers: await auth(admin),
    });
    const body = (await res.json()) as TimeEntry[];

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0]?.userId).toBe(other.id);
  });
});

describe('POST /time-entries', () => {
  it('creates a completed manual entry (201)', async () => {
    const res = await app.request('/time-entries', {
      method: 'POST',
      headers: await auth(member),
      body: JSON.stringify({
        startTime: '2026-01-05T09:00:00Z',
        endTime: '2026-01-05T10:00:00Z',
        note: 'Manual entry',
      }),
    });
    const body = (await res.json()) as TimeEntry;

    expect(res.status).toBe(201);
    expect(validateTimeEntry(body).success).toBe(true);
    expect(body.status).toBe('completed');
    expect(body.userId).toBe(member.id);
    expect(body.note).toBe('Manual entry');
  });

  it('rejects endTime <= startTime with 400', async () => {
    const res = await app.request('/time-entries', {
      method: 'POST',
      headers: await auth(member),
      body: JSON.stringify({
        startTime: '2026-01-05T10:00:00Z',
        endTime: '2026-01-05T09:00:00Z',
      }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects an overlapping entry with 409', async () => {
    repo.seed(
      completedEntry(member.id, '2026-01-05T09:00:00Z', '2026-01-05T11:00:00Z'),
    );

    const res = await app.request('/time-entries', {
      method: 'POST',
      headers: await auth(member),
      body: JSON.stringify({
        startTime: '2026-01-05T10:00:00Z',
        endTime: '2026-01-05T12:00:00Z',
      }),
    });
    expect(res.status).toBe(409);
  });

  it('rejects a malformed body with 400', async () => {
    const res = await app.request('/time-entries', {
      method: 'POST',
      headers: await auth(member),
      body: JSON.stringify({ startTime: '2026-01-05T09:00:00Z' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /time-entries/start', () => {
  it('starts a running entry (201)', async () => {
    const res = await app.request('/time-entries/start', {
      method: 'POST',
      headers: await auth(member),
      body: JSON.stringify({ note: 'Clocking in' }),
    });
    const body = (await res.json()) as TimeEntry;

    expect(res.status).toBe(201);
    expect(validateTimeEntry(body).success).toBe(true);
    expect(body.status).toBe('running');
    expect(body.endTime).toBeNull();
    expect(body.note).toBe('Clocking in');
  });

  it('accepts an empty body', async () => {
    const res = await app.request('/time-entries/start', {
      method: 'POST',
      headers: await auth(member),
    });
    expect(res.status).toBe(201);
  });

  it('rejects a second clock-in with 409', async () => {
    repo.seed(runningEntry(member.id, '2026-01-05T09:00:00Z'));

    const res = await app.request('/time-entries/start', {
      method: 'POST',
      headers: await auth(member),
    });
    expect(res.status).toBe(409);
  });
});

describe('POST /time-entries/stop', () => {
  it('stops the running entry (200)', async () => {
    repo.seed(runningEntry(member.id, '2020-01-05T09:00:00Z'));

    const res = await app.request('/time-entries/stop', {
      method: 'POST',
      headers: await auth(member),
      body: JSON.stringify({ note: 'Clocking out' }),
    });
    const body = (await res.json()) as TimeEntry;

    expect(res.status).toBe(200);
    expect(validateTimeEntry(body).success).toBe(true);
    expect(body.status).toBe('completed');
    expect(body.endTime).not.toBeNull();
    expect(body.note).toBe('Clocking out');
  });

  it('returns 404 when no entry is running', async () => {
    const res = await app.request('/time-entries/stop', {
      method: 'POST',
      headers: await auth(member),
    });
    expect(res.status).toBe(404);
  });

  it('returns 409 when the stopped interval overlaps an existing entry', async () => {
    repo.seed(runningEntry(member.id, '2020-01-05T09:00:00Z'));
    repo.seed(
      completedEntry(member.id, '2020-01-05T10:00:00Z', '2020-01-05T11:00:00Z'),
    );

    const res = await app.request('/time-entries/stop', {
      method: 'POST',
      headers: await auth(member),
    });
    expect(res.status).toBe(409);
  });
});

describe('GET /time-entries/:id', () => {
  it('returns the entry to its owner (200)', async () => {
    const entry = completedEntry(
      member.id,
      '2026-01-05T09:00:00Z',
      '2026-01-05T10:00:00Z',
    );
    repo.seed(entry);

    const res = await app.request(`/time-entries/${entry.id}`, {
      headers: await auth(member),
    });
    const body = (await res.json()) as TimeEntry;

    expect(res.status).toBe(200);
    expect(body.id).toBe(entry.id);
  });

  it('returns 404 for a missing entry', async () => {
    const res = await app.request(`/time-entries/${crypto.randomUUID()}`, {
      headers: await auth(member),
    });
    expect(res.status).toBe(404);
  });

  it('forbids a non-owner non-admin (403)', async () => {
    const entry = completedEntry(
      other.id,
      '2026-01-05T09:00:00Z',
      '2026-01-05T10:00:00Z',
    );
    repo.seed(entry);

    const res = await app.request(`/time-entries/${entry.id}`, {
      headers: await auth(member),
    });
    expect(res.status).toBe(403);
  });

  it("lets an admin read another user's entry (200)", async () => {
    const entry = completedEntry(
      other.id,
      '2026-01-05T09:00:00Z',
      '2026-01-05T10:00:00Z',
    );
    repo.seed(entry);

    const res = await app.request(`/time-entries/${entry.id}`, {
      headers: await auth(admin),
    });
    expect(res.status).toBe(200);
  });
});

describe('PATCH /time-entries/:id', () => {
  it('updates the note (200)', async () => {
    const entry = completedEntry(
      member.id,
      '2026-01-05T09:00:00Z',
      '2026-01-05T10:00:00Z',
    );
    repo.seed(entry);

    const res = await app.request(`/time-entries/${entry.id}`, {
      method: 'PATCH',
      headers: await auth(member),
      body: JSON.stringify({ note: 'Updated note' }),
    });
    const body = (await res.json()) as TimeEntry;

    expect(res.status).toBe(200);
    expect(body.note).toBe('Updated note');
    expect(validateTimeEntry(body).success).toBe(true);
  });

  it('returns 404 for a missing entry', async () => {
    const res = await app.request(`/time-entries/${crypto.randomUUID()}`, {
      method: 'PATCH',
      headers: await auth(member),
      body: JSON.stringify({ note: 'x' }),
    });
    expect(res.status).toBe(404);
  });

  it('forbids a non-owner non-admin (403)', async () => {
    const entry = completedEntry(
      other.id,
      '2026-01-05T09:00:00Z',
      '2026-01-05T10:00:00Z',
    );
    repo.seed(entry);

    const res = await app.request(`/time-entries/${entry.id}`, {
      method: 'PATCH',
      headers: await auth(member),
      body: JSON.stringify({ note: 'x' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 409 when the update would overlap another entry', async () => {
    repo.seed(
      completedEntry(member.id, '2026-01-05T09:00:00Z', '2026-01-05T10:00:00Z'),
    );
    const target = completedEntry(
      member.id,
      '2026-01-05T11:00:00Z',
      '2026-01-05T12:00:00Z',
    );
    repo.seed(target);

    const res = await app.request(`/time-entries/${target.id}`, {
      method: 'PATCH',
      headers: await auth(member),
      body: JSON.stringify({ startTime: '2026-01-05T09:30:00Z' }),
    });
    expect(res.status).toBe(409);
  });

  it('returns 409 when reopening would create a second running entry', async () => {
    repo.seed(runningEntry(member.id, '2026-01-05T13:00:00Z'));
    const target = completedEntry(
      member.id,
      '2026-01-05T09:00:00Z',
      '2026-01-05T10:00:00Z',
    );
    repo.seed(target);

    const res = await app.request(`/time-entries/${target.id}`, {
      method: 'PATCH',
      headers: await auth(member),
      body: JSON.stringify({ endTime: null }),
    });
    expect(res.status).toBe(409);
  });

  it('rejects a malformed body with 400', async () => {
    const entry = completedEntry(
      member.id,
      '2026-01-05T09:00:00Z',
      '2026-01-05T10:00:00Z',
    );
    repo.seed(entry);

    const res = await app.request(`/time-entries/${entry.id}`, {
      method: 'PATCH',
      headers: await auth(member),
      body: JSON.stringify({ startTime: 'not-a-timestamp' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /time-entries/:id', () => {
  it("deletes the owner's entry (204)", async () => {
    const entry = completedEntry(
      member.id,
      '2026-01-05T09:00:00Z',
      '2026-01-05T10:00:00Z',
    );
    repo.seed(entry);

    const res = await app.request(`/time-entries/${entry.id}`, {
      method: 'DELETE',
      headers: await auth(member),
    });

    expect(res.status).toBe(204);
    expect(await repo.findById(entry.id)).toBeNull();
  });

  it('returns 404 for a missing entry', async () => {
    const res = await app.request(`/time-entries/${crypto.randomUUID()}`, {
      method: 'DELETE',
      headers: await auth(member),
    });
    expect(res.status).toBe(404);
  });

  it('forbids a non-owner non-admin (403)', async () => {
    const entry = completedEntry(
      other.id,
      '2026-01-05T09:00:00Z',
      '2026-01-05T10:00:00Z',
    );
    repo.seed(entry);

    const res = await app.request(`/time-entries/${entry.id}`, {
      method: 'DELETE',
      headers: await auth(member),
    });
    expect(res.status).toBe(403);
  });
});
