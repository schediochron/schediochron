import { z } from 'zod';

export interface Team {
  id: string; // UUID v4; immutable
  name: string; // 1–255 characters
  adminIds: string[]; // UUID v4 refs; non-empty; subset of memberIds
  memberIds: string[]; // UUID v4 refs; non-empty; includes all admins
  createdAt: string; // ISO 8601 UTC
  updatedAt: string; // ISO 8601 UTC
}

export const teamSchema = z
  .object({
    id: z.string().uuid(),
    name: z
      .string()
      .min(1, 'Team name must not be empty')
      .max(255, 'Team name must be at most 255 characters')
      .transform((s) => s.trim())
      .pipe(z.string().min(1, 'Team name must not be blank')),
    adminIds: z
      .array(z.string().uuid())
      .min(1, 'Team must have at least one admin'),
    memberIds: z
      .array(z.string().uuid())
      .min(1, 'Team must have at least one member'),
    createdAt: z.string().datetime({ offset: false }),
    updatedAt: z.string().datetime({ offset: false }),
  })
  .superRefine((data, ctx) => {
    // Invariant: adminIds ⊆ memberIds
    const memberSet = new Set(data.memberIds);
    for (const adminId of data.adminIds) {
      if (!memberSet.has(adminId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['adminIds'],
          message: `Admin "${adminId}" must also be in memberIds`,
        });
      }
    }
  });

export function validateTeam(data: unknown): z.SafeParseReturnType<Team, Team> {
  return teamSchema.safeParse(data) as z.SafeParseReturnType<Team, Team>;
}
