import { Hono } from 'hono';
import type { TimeEntry } from '@schediochron/core';
import { stubCompletedEntry, stubRunningEntry } from '../stub-data.js';

/** `/time-entries` — manual entries and clock-in/clock-out. Stub responses (#83). */
export const timeEntryRoutes = new Hono();

const entryWithId = (id: string): TimeEntry => ({ ...stubCompletedEntry, id });

timeEntryRoutes.get('/', (c) =>
  c.json([stubCompletedEntry, stubRunningEntry], 200),
);

timeEntryRoutes.post('/', (c) => c.json(stubCompletedEntry, 201));

timeEntryRoutes.post('/start', (c) => c.json(stubRunningEntry, 201));

timeEntryRoutes.post('/stop', (c) => c.json(stubCompletedEntry, 200));

timeEntryRoutes.get('/:id', (c) => c.json(entryWithId(c.req.param('id')), 200));

timeEntryRoutes.patch('/:id', (c) =>
  c.json(entryWithId(c.req.param('id')), 200),
);

timeEntryRoutes.delete('/:id', (c) => c.body(null, 204));
