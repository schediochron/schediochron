import { createRouter } from '../http.js';
import { stubHoursReportDay } from '../stub-data.js';

/** `/reports` — hours reporting. Stub responses (#83). */
export const reportRoutes = createRouter();

reportRoutes.get('/hours', (c) => c.json([stubHoursReportDay], 200));
