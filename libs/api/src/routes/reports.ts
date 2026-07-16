import { Hono } from 'hono';
import { stubHoursReportDay } from '../stub-data.js';

/** `/reports` — hours reporting. Stub responses (#83). */
export const reportRoutes = new Hono();

reportRoutes.get('/hours', (c) => c.json([stubHoursReportDay], 200));
