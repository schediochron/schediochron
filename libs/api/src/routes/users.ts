import type { User } from '@schediochron/core';
import { createRouter } from '../http.js';
import { stubUser } from '../stub-data.js';

/** `/users` — user management. Stub responses (#83). */
export const userRoutes = createRouter();

// The requested id is echoed back so the stub reflects the path it was reached
// through; Phase 2 looks the user up instead.
const userWithId = (id: string): User => ({ ...stubUser, id });

userRoutes.get('/', (c) => c.json([stubUser], 200));

userRoutes.get('/:id', (c) => c.json(userWithId(c.req.param('id')), 200));

userRoutes.patch('/:id', (c) => c.json(userWithId(c.req.param('id')), 200));

userRoutes.patch('/:id/password', (c) => c.body(null, 204));
