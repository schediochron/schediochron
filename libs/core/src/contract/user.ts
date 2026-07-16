import type { UserRole } from '../models/user.js';

/** All fields optional; at least one must be provided. `null` clears the field. */
export interface UpdateUserRequest {
  displayName?: string | null; // max 100 chars
  email?: string | null;
  role?: UserRole; // admin only
}

export interface AdminPasswordResetRequest {
  newPassword: string; // min 8 chars
}
