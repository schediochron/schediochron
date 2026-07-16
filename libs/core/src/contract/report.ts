import type { TimeEntry } from '../models/time-entry.js';

/** Pre-set reporting window, shorthand for an explicit `from`/`to` pair. */
export type HoursReportRange = 'day' | 'week' | 'month';

/** Per-day summary in the hours report. */
export interface HoursReportDay {
  date: string; // ISO 8601 date, e.g. "2026-03-26"
  totalMinutes: number; // sum over the day's completed entries
  entries: TimeEntry[]; // completed entries falling on this date
}

/** Query parameters for `GET /reports/hours`. */
export interface HoursReportQuery {
  userId?: string; // defaults to the authenticated user; admins may pass any
  range?: HoursReportRange;
  from?: string; // ISO 8601 date; overrides `range`
  to?: string; // ISO 8601 date; overrides `range`
}
