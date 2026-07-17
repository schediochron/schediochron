import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from 'bun:test';
import type { SQL } from 'bun';
import { validateTimeEntry, type TimeEntry } from '@schediochron/core';
import { createSqlClient } from './db.js';
import { migrateUp } from './migrate.js';
import {
  mapRowToTimeEntry,
  zeroSeconds,
  RunningEntryExistsError,
  SqlTimeEntryRepository,
} from './time-entry-repository.js';

// --- Pure logic: row↔model mapping, always run (no database needed). ---

describe('mapRowToTimeEntry', () => {
  const base = {
    id: '11111111-1111-4111-8111-111111111111',
    user_id: '22222222-2222-4222-8222-222222222222',
    start_time: new Date('2024-01-01T09:00:00.000Z'),
    end_time: new Date('2024-01-01T10:00:00.000Z'),
    status: 'completed',
    note: 'shipped it',
    created_at: new Date('2024-01-01T09:00:12.000Z'),
    updated_at: new Date('2024-01-01T10:00:34.000Z'),
  };

  it('maps a completed row to the model with ISO 8601 UTC timestamps', () => {
    const entry = mapRowToTimeEntry(base);
    expect(entry).toEqual({
      id: base.id,
      userId: base.user_id,
      startTime: '2024-01-01T09:00:00.000Z',
      endTime: '2024-01-01T10:00:00.000Z',
      status: 'completed',
      note: 'shipped it',
      createdAt: '2024-01-01T09:00:12.000Z',
      updatedAt: '2024-01-01T10:00:34.000Z',
    });
    expect(validateTimeEntry(entry).success).toBe(true);
  });

  it('keeps endTime null while running', () => {
    const entry = mapRowToTimeEntry({
      ...base,
      status: 'running',
      end_time: null,
    });
    expect(entry.endTime).toBeNull();
    expect(entry.status).toBe('running');
    expect(validateTimeEntry(entry).success).toBe(true);
  });

  it('maps an absent note to null, never an empty string', () => {
    expect(mapRowToTimeEntry({ ...base, note: null }).note).toBeNull();
    expect(mapRowToTimeEntry({ ...base, note: '' }).note).toBeNull();
  });

  it('accepts string timestamps from the driver', () => {
    const entry = mapRowToTimeEntry({
      ...base,
      start_time: '2024-01-01T09:00:00Z',
      end_time: '2024-01-01T10:00:00Z',
    });
    expect(entry.startTime).toBe('2024-01-01T09:00:00.000Z');
    expect(entry.endTime).toBe('2024-01-01T10:00:00.000Z');
  });
});

describe('zeroSeconds', () => {
  it('floors seconds and milliseconds to zero (minute precision)', () => {
    expect(zeroSeconds('2024-01-01T23:40:59.678Z').toISOString()).toBe(
      '2024-01-01T23:40:00.000Z',
    );
  });

  it('leaves an already-zeroed timestamp unchanged', () => {
    expect(zeroSeconds('2024-01-01T23:40:00.000Z').toISOString()).toBe(
      '2024-01-01T23:40:00.000Z',
    );
  });
});

describe('RunningEntryExistsError', () => {
  it('carries the userId and a cause', () => {
    const cause = new Error('unique violation');
    const err = new RunningEntryExistsError('user-1', { cause });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('RunningEntryExistsError');
    expect(err.userId).toBe('user-1');
    expect(err.cause).toBe(cause);
  });
});

// --- Integration: gated on DATABASE_URL; there is no Postgres in CI, so these
// skip there. They exercise the running→completed lifecycle, findRunning, the
// one-running-entry rule, and find filters against a real database. ---

const uuid = (): string => crypto.randomUUID();

function makeEntry(userId: string, overrides: Partial<TimeEntry> = {}): TimeEntry {
  const now = new Date().toISOString();
  return {
    id: uuid(),
    userId,
    startTime: '2024-01-01T09:00:00Z',
    endTime: null,
    status: 'running',
    note: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe.skipIf(!process.env.DATABASE_URL)('SqlTimeEntryRepository (db)', () => {
  let sql: SQL;
  let repo: SqlTimeEntryRepository;
  let userId: string;

  beforeAll(async () => {
    sql = createSqlClient();
    repo = new SqlTimeEntryRepository(sql);
    await migrateUp(sql);
    userId = uuid();
    await sql`
      INSERT INTO users (id, username, role)
      VALUES (${userId}, ${`test_${userId.slice(0, 8)}`}, 'member')`;
  });

  afterEach(async () => {
    await sql`DELETE FROM time_entries WHERE user_id = ${userId}`;
  });

  afterAll(async () => {
    await sql`DELETE FROM users WHERE id = ${userId}`;
    await sql.close();
  });

  it('runs the running → completed lifecycle', async () => {
    const created = await repo.create(
      makeEntry(userId, { startTime: '2024-01-01T09:00:00Z', note: 'work' }),
    );
    expect(created.status).toBe('running');
    expect(created.endTime).toBeNull();
    expect(created.note).toBe('work');
    expect(validateTimeEntry(created).success).toBe(true);

    const running = await repo.findRunning(userId);
    expect(running?.id).toBe(created.id);

    const completed = await repo.update({
      ...created,
      status: 'completed',
      endTime: '2024-01-01T10:00:00Z',
    });
    expect(completed.status).toBe('completed');
    expect(completed.endTime).toBe('2024-01-01T10:00:00.000Z');
    expect(validateTimeEntry(completed).success).toBe(true);

    expect(await repo.findRunning(userId)).toBeNull();
  });

  it('rejects a second running entry with RunningEntryExistsError', async () => {
    await repo.create(makeEntry(userId, { startTime: '2024-01-01T09:00:00Z' }));
    await expect(
      repo.create(makeEntry(userId, { startTime: '2024-01-01T11:00:00Z' })),
    ).rejects.toBeInstanceOf(RunningEntryExistsError);
  });

  it('findRunning returns null when clocked out', async () => {
    expect(await repo.findRunning(userId)).toBeNull();
  });

  it('applies find filters (status, from/to bound start_time inclusively)', async () => {
    await repo.create(
      makeEntry(userId, {
        status: 'completed',
        startTime: '2024-01-01T09:00:00Z',
        endTime: '2024-01-01T10:00:00Z',
      }),
    );
    await repo.create(
      makeEntry(userId, {
        status: 'completed',
        startTime: '2024-01-02T09:00:00Z',
        endTime: '2024-01-02T10:00:00Z',
      }),
    );
    await repo.create(
      makeEntry(userId, { status: 'running', startTime: '2024-01-03T09:00:00Z' }),
    );

    expect(await repo.find({ userId })).toHaveLength(3);
    expect(await repo.find({ userId, status: 'running' })).toHaveLength(1);
    expect(await repo.find({ userId, status: 'completed' })).toHaveLength(2);

    const bounded = await repo.find({
      userId,
      from: '2024-01-01T09:00:00Z',
      to: '2024-01-02T09:00:00Z',
    });
    expect(bounded).toHaveLength(2);
  });
});
