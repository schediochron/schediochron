import type { TimeEntry } from '../models/time-entry.js';

export interface TimeEntryRepository {
  findById(id: string): Promise<TimeEntry | null>;
  findAll(userId: string): Promise<TimeEntry[]>;
  create(entry: TimeEntry): Promise<TimeEntry>;
  update(entry: TimeEntry): Promise<TimeEntry>;
  delete(id: string): Promise<void>;
}
