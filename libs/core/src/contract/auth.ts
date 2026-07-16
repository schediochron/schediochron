import type { User } from '../models/user.js';

export interface TokenPair {
  accessToken: string; // short-lived signed JWT
  refreshToken: string; // long-lived opaque token
}

/** Successful authentication — the user plus a fresh token pair. */
export interface AuthResponse extends TokenPair {
  user: User;
}

export interface RegisterRequest {
  username: string; // 3–50 chars, [a-zA-Z0-9_-]
  password: string; // min 8 chars
  displayName?: string; // 1–100 chars
  email?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface LogoutRequest {
  refreshToken: string;
}
