import { Hono } from 'hono';
import type { Team } from '@schediochron/core';
import { stubTeam } from '../stub-data.js';

/** `/teams` — team management and membership. Stub responses (#83). */
export const teamRoutes = new Hono();

const teamWithId = (id: string): Team => ({ ...stubTeam, id });

teamRoutes.get('/', (c) => c.json([stubTeam], 200));

teamRoutes.post('/', (c) => c.json(stubTeam, 201));

teamRoutes.get('/:id', (c) => c.json(teamWithId(c.req.param('id')), 200));

teamRoutes.patch('/:id', (c) => c.json(teamWithId(c.req.param('id')), 200));

teamRoutes.delete('/:id', (c) => c.body(null, 204));

teamRoutes.post('/:id/members', (c) =>
  c.json(teamWithId(c.req.param('id')), 200),
);

teamRoutes.delete('/:id/members/:userId', (c) =>
  c.json(teamWithId(c.req.param('id')), 200),
);
