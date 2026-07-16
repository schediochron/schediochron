import type { TimeEntry, TimeEntryStatus } from '../models/time-entry.js';
import type { CrudRepository } from './crud-repository.js';

export interface TimeEntryRepository extends CrudRepository<TimeEntry> {
  /**
   * The user's open entry, or `null` when they are clocked out.
   *
   * Returns at most one: a user has at most one running entry, and this is
   * where that invariant is enforced on clock-in.
   */
  findRunning(userId: string): Promise<TimeEntry | null>;

  /**
   * Entries matching every criterion given; omitted criteria don't constrain.
   * `from`/`to` bound `startTime` inclusively.
   */
  find(filter: {
    userId?: string;
    status?: TimeEntryStatus;
    from?: string;
    to?: string;
  }): Promise<TimeEntry[]>;
}
