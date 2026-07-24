import type { TimeEntry } from '@schediochron/core';
import { RunningEntryExistsError } from '@schediochron/sql';
import { getAuthenticatedUser, requireAuth } from '../auth/middleware.js';
import {
  badRequest,
  conflict,
  createRouter,
  forbidden,
  formatZodIssues,
  notFound,
} from '../http.js';
import { provideRepositories } from '../repositories.js';
import {
  createTimeEntryRequestSchema,
  listTimeEntriesQuerySchema,
  startTimeEntryRequestSchema,
  stopTimeEntryRequestSchema,
  updateTimeEntryRequestSchema,
} from '../schemas.js';

/**
 * `/time-entries` — manual entries and clock-in/clock-out (#31).
 *
 * Every route is behind {@link requireAuth}; entries are scoped to the
 * authenticated caller, and an entry may only be read or written by its owner or
 * a system admin. The ADR-001 invariants the database cannot express on its own
 * — the no-overlap rule between completed entries — are enforced here, while the
 * one-running-entry-per-user rule is left to the repository, surfacing as a
 * {@link RunningEntryExistsError} that becomes a 409.
 */
export const timeEntryRoutes = createRouter();

timeEntryRoutes.use('*', provideRepositories, requireAuth);

/** The current instant, floored to minute precision, as an ISO 8601 UTC string. */
function nowFloored(): string {
  return floorToMinuteIso(new Date().toISOString());
}

/**
 * An ISO 8601 timestamp with its seconds (and milliseconds) floored to zero —
 * minute precision, per ADR-001, applied before any comparison or write so the
 * value the handler reasons about matches the value the repository stores.
 */
function floorToMinuteIso(iso: string): string {
  const date = new Date(iso);
  date.setUTCSeconds(0, 0);
  return date.toISOString();
}

/** Empty and absent notes collapse to `null`, never `''` (ADR-001). */
function normalizeNote(note: string | null | undefined): string | null {
  return note === undefined || note === null || note === '' ? null : note;
}

/**
 * Whether the half-open intervals `[aStart, aEnd)` and `[bStart, bEnd)` overlap.
 * Entries that merely share an endpoint do not overlap (ADR-001).
 */
function intervalsOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  const as = new Date(aStart).getTime();
  const ae = new Date(aEnd).getTime();
  const bs = new Date(bStart).getTime();
  const be = new Date(bEnd).getTime();
  return as < be && bs < ae;
}

/**
 * The owner's first completed entry that overlaps `[startTime, endTime)`, or
 * `null` when the interval is free. `excludeId` drops the entry being updated
 * from its own overlap check.
 */
async function findOverlap(
  timeEntries: {
    find: (filter: {
      userId?: string;
      status?: 'completed';
    }) => Promise<TimeEntry[]>;
  },
  userId: string,
  startTime: string,
  endTime: string,
  excludeId?: string,
): Promise<TimeEntry | null> {
  const completed = await timeEntries.find({ userId, status: 'completed' });
  for (const other of completed) {
    if (other.id === excludeId || other.endTime === null) {
      continue;
    }
    if (intervalsOverlap(startTime, endTime, other.startTime, other.endTime)) {
      return other;
    }
  }
  return null;
}

/**
 * Parse an optional JSON body. `/start` and `/stop` accept an empty body, which
 * `c.req.json()` would reject; an empty or absent body is treated as `{}`.
 */
async function readOptionalJson(c: {
  req: { text: () => Promise<string> };
}): Promise<unknown> {
  const raw = await c.req.text();
  if (raw.trim() === '') {
    return {};
  }
  return JSON.parse(raw) as unknown;
}

// GET /time-entries — list; defaults to the caller's own entries. Admins may
// request another user's entries via `?userId=`; a non-admin may only name
// their own id.
timeEntryRoutes.get('/', async (c) => {
  const { timeEntries } = c.get('repositories');
  const user = getAuthenticatedUser(c);

  const parsed = listTimeEntriesQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return badRequest(c, 'Validation failed', formatZodIssues(parsed.error));
  }

  let userId = user.id;
  if (parsed.data.userId !== undefined && parsed.data.userId !== user.id) {
    if (user.role !== 'admin') {
      return forbidden(c, "Cannot list another user's time entries");
    }
    userId = parsed.data.userId;
  }

  const entries = await timeEntries.find({
    userId,
    status: parsed.data.status,
  });
  return c.json(entries, 200);
});

// POST /time-entries — create a completed manual entry for the caller.
timeEntryRoutes.post('/', async (c) => {
  const { timeEntries } = c.get('repositories');
  const user = getAuthenticatedUser(c);

  const parsed = createTimeEntryRequestSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return badRequest(c, 'Validation failed', formatZodIssues(parsed.error));
  }

  const startTime = floorToMinuteIso(parsed.data.startTime);
  const endTime = floorToMinuteIso(parsed.data.endTime);
  if (new Date(endTime).getTime() <= new Date(startTime).getTime()) {
    return badRequest(c, 'endTime must be after startTime');
  }

  if (await findOverlap(timeEntries, user.id, startTime, endTime)) {
    return conflict(c, 'Time entry overlaps an existing entry');
  }

  const now = new Date().toISOString();
  const entry: TimeEntry = {
    id: crypto.randomUUID(),
    userId: user.id,
    startTime,
    endTime,
    status: 'completed',
    note: normalizeNote(parsed.data.note),
    createdAt: now,
    updatedAt: now,
  };

  const created = await timeEntries.create(entry);
  return c.json(created, 201);
});

// POST /time-entries/start — clock in; blocked if one already runs.
timeEntryRoutes.post('/start', async (c) => {
  const { timeEntries } = c.get('repositories');
  const user = getAuthenticatedUser(c);

  const parsed = startTimeEntryRequestSchema.safeParse(
    await readOptionalJson(c),
  );
  if (!parsed.success) {
    return badRequest(c, 'Validation failed', formatZodIssues(parsed.error));
  }

  if (await timeEntries.findRunning(user.id)) {
    return conflict(c, 'A time entry is already running');
  }

  const now = new Date().toISOString();
  const entry: TimeEntry = {
    id: crypto.randomUUID(),
    userId: user.id,
    startTime: nowFloored(),
    endTime: null,
    status: 'running',
    note: normalizeNote(parsed.data.note),
    createdAt: now,
    updatedAt: now,
  };

  try {
    const created = await timeEntries.create(entry);
    return c.json(created, 201);
  } catch (err) {
    if (err instanceof RunningEntryExistsError) {
      return conflict(c, 'A time entry is already running');
    }
    throw err;
  }
});

// POST /time-entries/stop — clock out the running entry.
timeEntryRoutes.post('/stop', async (c) => {
  const { timeEntries } = c.get('repositories');
  const user = getAuthenticatedUser(c);

  const parsed = stopTimeEntryRequestSchema.safeParse(
    await readOptionalJson(c),
  );
  if (!parsed.success) {
    return badRequest(c, 'Validation failed', formatZodIssues(parsed.error));
  }

  const running = await timeEntries.findRunning(user.id);
  if (!running) {
    return notFound(c, 'No running time entry to stop');
  }

  const endTime = nowFloored();
  if (new Date(endTime).getTime() <= new Date(running.startTime).getTime()) {
    return conflict(c, 'Running entry is shorter than the minute resolution');
  }

  if (
    await findOverlap(
      timeEntries,
      user.id,
      running.startTime,
      endTime,
      running.id,
    )
  ) {
    return conflict(c, 'Stopped entry overlaps an existing entry');
  }

  const stopped: TimeEntry = {
    ...running,
    endTime,
    status: 'completed',
    note:
      parsed.data.note === undefined
        ? running.note
        : normalizeNote(parsed.data.note),
    updatedAt: new Date().toISOString(),
  };

  const updated = await timeEntries.update(stopped);
  return c.json(updated, 200);
});

// GET /time-entries/:id — owner or admin only.
timeEntryRoutes.get('/:id', async (c) => {
  const { timeEntries } = c.get('repositories');
  const user = getAuthenticatedUser(c);

  const entry = await timeEntries.findById(c.req.param('id'));
  if (!entry) {
    return notFound(c, 'Time entry not found');
  }
  if (entry.userId !== user.id && user.role !== 'admin') {
    return forbidden(c, "Cannot access another user's time entry");
  }
  return c.json(entry, 200);
});

// PATCH /time-entries/:id — update note/startTime/endTime; owner or admin only.
timeEntryRoutes.patch('/:id', async (c) => {
  const { timeEntries } = c.get('repositories');
  const user = getAuthenticatedUser(c);

  const parsed = updateTimeEntryRequestSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return badRequest(c, 'Validation failed', formatZodIssues(parsed.error));
  }

  const entry = await timeEntries.findById(c.req.param('id'));
  if (!entry) {
    return notFound(c, 'Time entry not found');
  }
  if (entry.userId !== user.id && user.role !== 'admin') {
    return forbidden(c, "Cannot modify another user's time entry");
  }

  const startTime =
    parsed.data.startTime !== undefined
      ? floorToMinuteIso(parsed.data.startTime)
      : entry.startTime;

  let endTime = entry.endTime;
  if (parsed.data.endTime !== undefined) {
    endTime =
      parsed.data.endTime === null
        ? null
        : floorToMinuteIso(parsed.data.endTime);
  }

  const note =
    parsed.data.note === undefined
      ? entry.note
      : normalizeNote(parsed.data.note);

  const status = endTime === null ? 'running' : 'completed';

  if (endTime !== null) {
    if (new Date(endTime).getTime() <= new Date(startTime).getTime()) {
      return badRequest(c, 'endTime must be after startTime');
    }
    if (
      await findOverlap(timeEntries, entry.userId, startTime, endTime, entry.id)
    ) {
      return conflict(c, 'Updated entry overlaps an existing entry');
    }
  } else {
    // Turning the entry back into a running one must not create a second open
    // entry for the owner.
    const running = await timeEntries.findRunning(entry.userId);
    if (running && running.id !== entry.id) {
      return conflict(c, 'A time entry is already running');
    }
  }

  const next: TimeEntry = {
    ...entry,
    startTime,
    endTime,
    status,
    note,
    updatedAt: new Date().toISOString(),
  };

  try {
    const updated = await timeEntries.update(next);
    return c.json(updated, 200);
  } catch (err) {
    if (err instanceof RunningEntryExistsError) {
      return conflict(c, 'A time entry is already running');
    }
    throw err;
  }
});

// DELETE /time-entries/:id — owner or admin only.
timeEntryRoutes.delete('/:id', async (c) => {
  const { timeEntries } = c.get('repositories');
  const user = getAuthenticatedUser(c);

  const entry = await timeEntries.findById(c.req.param('id'));
  if (!entry) {
    return notFound(c, 'Time entry not found');
  }
  if (entry.userId !== user.id && user.role !== 'admin') {
    return forbidden(c, "Cannot delete another user's time entry");
  }

  await timeEntries.delete(entry.id);
  return c.body(null, 204);
});
