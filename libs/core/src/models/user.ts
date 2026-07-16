import { z } from 'zod';

export type UserRole = 'admin' | 'member';

export interface User {
  id: string; // UUID v4; immutable after creation
  username: string; // unique system-wide; immutable after creation
  displayName: string | null; // shown in UI instead of username when present; max 100 chars
  email: string | null; // unique system-wide when present; enables self-service pwd reset
  role: UserRole;
  createdAt: string; // ISO 8601 UTC
  updatedAt: string; // ISO 8601 UTC
}

export const userSchema = z.object({
  id: z.string().uuid(),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be at most 50 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Username may only contain alphanumeric characters, hyphens, and underscores',
    ),
  displayName: z
    .string()
    .min(1, 'displayName must not be empty; use null instead')
    .max(100, 'displayName must be at most 100 characters')
    .nullable(),
  email: z
    .string()
    .email('email must be a valid RFC 5321 address')
    .min(1, 'email must not be empty; use null instead')
    .nullable(),
  role: z.enum(['admin', 'member']),
  createdAt: z.string().datetime({ offset: false }),
  updatedAt: z.string().datetime({ offset: false }),
});

export function validateUser(data: unknown): z.SafeParseReturnType<User, User> {
  return userSchema.safeParse(data) as z.SafeParseReturnType<User, User>;
}
