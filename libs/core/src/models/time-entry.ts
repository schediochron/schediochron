import { z } from 'zod';

export type TimeEntryStatus = 'running' | 'completed';

export interface TimeEntry {
  id: string; // UUID v4; immutable after creation
  userId: string; // UUID v4; references owning user; immutable after creation
  startTime: string; // ISO 8601 UTC, seconds zeroed
  endTime: string | null; // ISO 8601 UTC, seconds zeroed; null when running
  status: TimeEntryStatus;
  note: string | null; // max 255 characters; null if not provided
  createdAt: string; // ISO 8601 UTC
  updatedAt: string; // ISO 8601 UTC
}

const isoUtcSecondsZeroed = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00(?:\.\d+)?Z$/,
    'Must be an ISO 8601 UTC timestamp with seconds zeroed (e.g. 2024-01-01T10:00:00Z)',
  );

export const timeEntrySchema = z
  .object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    startTime: isoUtcSecondsZeroed,
    endTime: isoUtcSecondsZeroed.nullable(),
    status: z.enum(['running', 'completed']),
    note: z.string().min(1).max(255).nullable(),
    createdAt: z.string().datetime({ offset: false }),
    updatedAt: z.string().datetime({ offset: false }),
  })
  .superRefine((data, ctx) => {
    // Invariant 1: running ↔ endTime === null
    if (data.status === 'running' && data.endTime !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endTime'],
        message: 'endTime must be null when status is "running"',
      });
    }
    if (data.status === 'completed' && data.endTime === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endTime'],
        message: 'endTime must be set when status is "completed"',
      });
    }
    // Invariant 2: startTime < endTime
    if (data.endTime !== null) {
      const start = new Date(data.startTime).getTime();
      const end = new Date(data.endTime).getTime();
      if (end <= start) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endTime'],
          message: 'endTime must be after startTime',
        });
      }
    }
  });

export function validateTimeEntry(
  data: unknown,
): z.SafeParseReturnType<TimeEntry, TimeEntry> {
  return timeEntrySchema.safeParse(data) as z.SafeParseReturnType<
    TimeEntry,
    TimeEntry
  >;
}
