import type { AuthResponse } from '@schediochron/core';
import { createRouter } from '../http.js';
import { stubTokenPair, stubUser } from '../stub-data.js';

/** `/auth` — authentication and token management. Stub responses (#83). */
export const authRoutes = createRouter();

const authResponse: AuthResponse = { user: stubUser, ...stubTokenPair };

authRoutes.post('/register', (c) => c.json(authResponse, 201));

authRoutes.post('/login', (c) => c.json(authResponse, 200));

authRoutes.post('/refresh', (c) => c.json(stubTokenPair, 200));

authRoutes.post('/logout', (c) => c.body(null, 204));
