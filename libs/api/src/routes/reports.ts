import type {
  HoursReportDay,
  HoursReportQuery,
  TimeEntry,
} from '@schediochron/core';
import { computeDuration } from '@schediochron/core';
import { getAuthenticatedUser, requireAuth } from '../auth/middleware.js';
import {
  badRequest,
  createRouter,
  forbidden,
  formatZodIssues,
} from '../http.js';
import { provideRepositories } from '../repositories.js';
import { hoursReportQuerySchema } from '../schemas.js';

/**
 * `/reports` — hours reporting (#33).
 *
 * `GET /reports/hours` returns a daily breakdown of completed hours for a user
 * over a date window. Only completed entries contribute: running entries have no
 * `endTime` and therefore no duration (ADR-001). Duration is derived per entry
 * via {@link computeDuration} and never stored, so the report re-derives every
 * `totalMinutes` from the entries it lists.
 */
export const reportRoutes = createRouter();

reportRoutes.use('*', provideRepositories, requireAuth);

reportRoutes.get('/hours', async (c) => {
  const parsed = hoursReportQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return badRequest(c, 'Validation failed', formatZodIssues(parsed.error));
  }
  const query = parsed.data;
  const user = getAuthenticatedUser(c);

  // Default to the caller's own data; only admins may report on another user.
  const targetUserId = query.userId ?? user.id;
  if (targetUserId !== user.id && user.role !== 'admin') {
    return forbidden(c, 'Cannot report on another user');
  }

  const { from, to } = resolveWindow(query);

  const { timeEntries } = c.get('repositories');
  const entries = await timeEntries.find({
    userId: targetUserId,
    from,
    to,
    status: 'completed',
  });

  return c.json(aggregateByDay(entries), 200);
});

/**
 * The reporting window as inclusive ISO 8601 dates. An explicit `from`/`to`
 * overrides the `range` shorthand; otherwise `range` (defaulting to `week`) is
 * resolved to a span of days ending today.
 */
function resolveWindow(query: HoursReportQuery): {
  from?: string;
  to?: string;
} {
  if (query.from !== undefined || query.to !== undefined) {
    return { from: query.from, to: query.to };
  }
  const spanDays = rangeSpanDays(query.range ?? 'week');
  const today = new Date();
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - (spanDays - 1));
  return { from: isoDate(start), to: isoDate(today) };
}

/** Days covered by a `range` shorthand, inclusive of today. */
function rangeSpanDays(range: NonNullable<HoursReportQuery['range']>): number {
  switch (range) {
    case 'day':
      return 1;
    case 'week':
      return 7;
    case 'month':
      return 30;
  }
}

/** The UTC calendar date (`YYYY-MM-DD`) of a timestamp. */
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Buckets completed entries by the UTC date of their `startTime`, summing each
 * day's durations into `totalMinutes`. Days are returned in ascending date order
 * so the breakdown is deterministic.
 */
function aggregateByDay(entries: TimeEntry[]): HoursReportDay[] {
  const byDay = new Map<string, TimeEntry[]>();
  for (const entry of entries) {
    const date = entry.startTime.slice(0, 10);
    const bucket = byDay.get(date);
    if (bucket) {
      bucket.push(entry);
    } else {
      byDay.set(date, [entry]);
    }
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayEntries]) => ({
      date,
      totalMinutes: dayEntries.reduce(
        (total, entry) => total + (computeDuration(entry) ?? 0) / 60_000,
        0,
      ),
      entries: dayEntries,
    }));
}
