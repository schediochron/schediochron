import type { TimeEntry } from '../models/time-entry.js';

/**
 * Computes the duration of a completed time entry in milliseconds.
 * Returns null for running entries (no endTime).
 */
export function computeDuration(entry: TimeEntry): number | null {
  if (entry.endTime === null) {
    return null;
  }
  return (
    new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime()
  );
}
