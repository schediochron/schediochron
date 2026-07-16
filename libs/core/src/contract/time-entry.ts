import type { TimeEntryStatus } from '../models/time-entry.js';

/** Creates a completed (manual) entry — both ends are required. */
export interface CreateTimeEntryRequest {
  startTime: string; // ISO 8601 UTC; seconds will be zeroed
  endTime: string; // ISO 8601 UTC; must be after startTime
  note?: string; // max 255 chars
}

/** All fields optional; at least one must be provided. `null` clears the field. */
export interface UpdateTimeEntryRequest {
  startTime?: string;
  endTime?: string | null;
  note?: string | null;
}

export interface StartTimeEntryRequest {
  note?: string; // max 255 chars
}

export interface StopTimeEntryRequest {
  note?: string | null; // set or overwrite the note at clock-out
}

/** Query parameters for `GET /time-entries`. */
export interface ListTimeEntriesQuery {
  userId?: string; // admin only
  status?: TimeEntryStatus;
}
