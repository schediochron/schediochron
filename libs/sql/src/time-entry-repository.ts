import type { SQL } from 'bun';
import type {
  TimeEntry,
  TimeEntryStatus,
  TimeEntryRepository,
} from '@schediochron/core';

/**
 * The `time_entries` row as Bun's SQL client hands it back: snake_case columns,
 * `timestamptz` values as `Date` (occasionally a string depending on driver
 * config, hence the union), `note`/`end_time` nullable.
 */
interface TimeEntryRow {
  id: string;
  user_id: string;
  start_time: Date | string;
  end_time: Date | string | null;
  status: string;
  note: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

/** The partial unique index enforcing one running entry per user (ADR-001). */
const RUNNING_ENTRY_INDEX = 'time_entries_one_running_per_user';

/** Postgres SQLSTATE for a unique-violation. */
const UNIQUE_VIOLATION = '23505';

/**
 * A user already has an open entry, so a second clock-in was rejected by the
 * `time_entries_one_running_per_user` index. The API turns this into a 409.
 *
 * The one-running-entry invariant lives in the database (the partial unique
 * index); this class is only the typed surface for the violation it raises, so
 * the rule is never re-checked in application code.
 */
export class RunningEntryExistsError extends Error {
  readonly userId: string;

  constructor(userId: string, options?: { cause?: unknown }) {
    super(`User ${userId} already has a running time entry.`, options);
    this.name = 'RunningEntryExistsError';
    this.userId = userId;
  }
}

// TODO(#…): extract shared row mapping — other repositories (#27, #28) map
// timestamptz→ISO the same way; kept local for now while the package is edited
// concurrently.

/** A `timestamptz` value from the driver as an ISO 8601 UTC string. */
function dbTimestampToIso(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

/**
 * The instant for a model timestamp with its seconds (and milliseconds) floored
 * to zero — minute precision, per ADR-001, applied on every write.
 */
export function zeroSeconds(iso: string): Date {
  const date = new Date(iso);
  date.setUTCSeconds(0, 0);
  return date;
}

/** Empty notes are stored and returned as `null`, never `''` (ADR-001). */
function normalizeNote(note: string | null): string | null {
  return note === '' ? null : note;
}

/** Maps a stored row to the `TimeEntry` model exactly. */
export function mapRowToTimeEntry(row: TimeEntryRow): TimeEntry {
  return {
    id: row.id,
    userId: row.user_id,
    startTime: dbTimestampToIso(row.start_time),
    endTime: row.end_time === null ? null : dbTimestampToIso(row.end_time),
    status: row.status as TimeEntryStatus,
    note: normalizeNote(row.note),
    createdAt: dbTimestampToIso(row.created_at),
    updatedAt: dbTimestampToIso(row.updated_at),
  };
}

/** True when `err` is the unique-violation raised by a second running entry. */
function isRunningEntryUniqueViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) {
    return false;
  }
  const e = err as {
    code?: unknown;
    constraint?: unknown;
    detail?: unknown;
    message?: unknown;
  };
  if (e.code !== UNIQUE_VIOLATION) {
    return false;
  }
  if (e.constraint === RUNNING_ENTRY_INDEX) {
    return true;
  }
  // Fall back to the message when the driver doesn't populate `constraint`,
  // so a primary-key collision (a different unique index) isn't misread.
  const detail = typeof e.detail === 'string' ? e.detail : '';
  const message = typeof e.message === 'string' ? e.message : '';
  return `${detail} ${message}`.includes(RUNNING_ENTRY_INDEX);
}

/**
 * PostgreSQL-backed {@link TimeEntryRepository} over Bun's native SQL client.
 *
 * Schema-enforced invariants (one running entry per user, status↔end_time,
 * start<end) are left to the database; the only application-level translation is
 * surfacing the running-entry unique violation as {@link RunningEntryExistsError}
 * so the API can answer 409. CHECK-constraint violations propagate unchanged.
 */
export class SqlTimeEntryRepository implements TimeEntryRepository {
  constructor(private readonly sql: SQL) {}

  async findById(id: string): Promise<TimeEntry | null> {
    const rows = (await this
      .sql`SELECT * FROM time_entries WHERE id = ${id}`) as TimeEntryRow[];
    const row = rows[0];
    return row ? mapRowToTimeEntry(row) : null;
  }

  async findAll(): Promise<TimeEntry[]> {
    const rows = (await this
      .sql`SELECT * FROM time_entries ORDER BY start_time, id`) as TimeEntryRow[];
    return rows.map(mapRowToTimeEntry);
  }

  async create(item: TimeEntry): Promise<TimeEntry> {
    try {
      const rows = (await this.sql`
        INSERT INTO time_entries (id, user_id, start_time, end_time, status, note)
        VALUES (
          ${item.id},
          ${item.userId},
          ${zeroSeconds(item.startTime)},
          ${item.endTime === null ? null : zeroSeconds(item.endTime)},
          ${item.status},
          ${normalizeNote(item.note)}
        )
        RETURNING *`) as TimeEntryRow[];
      return mapRowToTimeEntry(rows[0]);
    } catch (err) {
      throw this.translateWriteError(err, item.userId);
    }
  }

  async update(item: TimeEntry): Promise<TimeEntry> {
    let rows: TimeEntryRow[];
    try {
      rows = (await this.sql`
        UPDATE time_entries
        SET start_time = ${zeroSeconds(item.startTime)},
            end_time = ${item.endTime === null ? null : zeroSeconds(item.endTime)},
            status = ${item.status},
            note = ${normalizeNote(item.note)},
            updated_at = now()
        WHERE id = ${item.id}
        RETURNING *`) as TimeEntryRow[];
    } catch (err) {
      throw this.translateWriteError(err, item.userId);
    }
    const row = rows[0];
    if (!row) {
      throw new Error(`TimeEntry ${item.id} not found`);
    }
    return mapRowToTimeEntry(row);
  }

  async delete(id: string): Promise<void> {
    await this.sql`DELETE FROM time_entries WHERE id = ${id}`;
  }

  async findRunning(userId: string): Promise<TimeEntry | null> {
    const rows = (await this.sql`
      SELECT * FROM time_entries
      WHERE user_id = ${userId} AND status = 'running'`) as TimeEntryRow[];
    const row = rows[0];
    return row ? mapRowToTimeEntry(row) : null;
  }

  async find(filter: {
    userId?: string;
    status?: TimeEntryStatus;
    from?: string;
    to?: string;
  }): Promise<TimeEntry[]> {
    const conditions: SQL.Query<unknown>[] = [];
    if (filter.userId !== undefined) {
      conditions.push(this.sql`user_id = ${filter.userId}`);
    }
    if (filter.status !== undefined) {
      conditions.push(this.sql`status = ${filter.status}`);
    }
    if (filter.from !== undefined) {
      conditions.push(this.sql`start_time >= ${new Date(filter.from)}`);
    }
    if (filter.to !== undefined) {
      conditions.push(this.sql`start_time <= ${new Date(filter.to)}`);
    }

    let where: SQL.Query<unknown> = this.sql``;
    if (conditions.length > 0) {
      let combined = conditions[0];
      for (let i = 1; i < conditions.length; i++) {
        combined = this.sql`${combined} AND ${conditions[i]}`;
      }
      where = this.sql`WHERE ${combined}`;
    }

    const rows = (await this
      .sql`SELECT * FROM time_entries ${where} ORDER BY start_time, id`) as TimeEntryRow[];
    return rows.map(mapRowToTimeEntry);
  }

  /**
   * Maps a write failure to a typed error the API layer understands, or returns
   * it unchanged. Only the running-entry unique violation is translated; CHECK
   * violations propagate so their message reaches the caller intact.
   */
  private translateWriteError(err: unknown, userId: string): unknown {
    if (isRunningEntryUniqueViolation(err)) {
      return new RunningEntryExistsError(userId, { cause: err });
    }
    return err;
  }
}
