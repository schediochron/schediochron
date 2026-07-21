import type { Context } from 'hono';
import type { Team } from '@schediochron/core';
import { LastAdminError } from '@schediochron/sql';
import {
  getAuthenticatedUser,
  isTeamAdmin,
  requireAuth,
} from '../auth/middleware.js';
import {
  badRequest,
  conflict,
  createRouter,
  forbidden,
  formatZodIssues,
  notFound,
} from '../http.js';
import { provideRepositories } from '../repositories.js';
import {
  addTeamMemberRequestSchema,
  createTeamRequestSchema,
  updateTeamRequestSchema,
} from '../schemas.js';

/**
 * `/teams` — team management and membership (ADR-004).
 *
 * Two authorisation axes apply. Reads are scoped to teams the caller belongs to
 * (`findByUserId`); a team you are not in is indistinguishable from one that does
 * not exist (404). Mutations require **team-admin** rights over the *loaded* team
 * — `isTeamAdmin(user.id, team)`, a per-team decision distinct from the system
 * role — and answer 403 otherwise.
 *
 * The membership invariants (`adminIds ⊆ memberIds`, at least one admin) are
 * enforced by the repository's dedicated `addMember`/`removeMember` mutations,
 * not by a read-modify-write here; `LastAdminError` from that layer maps to 409.
 */
export const teamRoutes = createRouter();

teamRoutes.use('*', provideRepositories, requireAuth);

/** Reads the request body as JSON, or `undefined` when absent/malformed. */
async function readJsonBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
}

// GET /teams — teams the authenticated user belongs to.
teamRoutes.get('/', async (c) => {
  const { teams } = c.get('repositories');
  const user = getAuthenticatedUser(c);
  return c.json(await teams.findByUserId(user.id), 200);
});

// POST /teams — create a team; the creator becomes its first admin and member.
teamRoutes.post('/', async (c) => {
  const { teams } = c.get('repositories');
  const user = getAuthenticatedUser(c);

  const parsed = createTeamRequestSchema.safeParse(await readJsonBody(c));
  if (!parsed.success) {
    return badRequest(c, 'Validation failed', formatZodIssues(parsed.error));
  }

  const now = new Date().toISOString();
  const team: Team = {
    id: crypto.randomUUID(),
    name: parsed.data.name,
    adminIds: [user.id],
    memberIds: [user.id],
    createdAt: now,
    updatedAt: now,
  };
  return c.json(await teams.create(team), 201);
});

// GET /teams/:id — fetch a team; visible only to its members.
teamRoutes.get('/:id', async (c) => {
  const { teams } = c.get('repositories');
  const user = getAuthenticatedUser(c);

  const team = await teams.findById(c.req.param('id'));
  // A team the caller is not a member of is not distinguishable from a missing
  // one — both answer 404 so membership is not probeable.
  if (!team || !team.memberIds.includes(user.id)) {
    return notFound(c, 'Team not found');
  }
  return c.json(team, 200);
});

// PATCH /teams/:id — rename a team; team admin only.
teamRoutes.patch('/:id', async (c) => {
  const { teams } = c.get('repositories');
  const user = getAuthenticatedUser(c);

  const team = await teams.findById(c.req.param('id'));
  if (!team) {
    return notFound(c, 'Team not found');
  }
  if (!isTeamAdmin(user.id, team)) {
    return forbidden(c, 'Only a team admin may update this team');
  }

  const parsed = updateTeamRequestSchema.safeParse(await readJsonBody(c));
  if (!parsed.success) {
    return badRequest(c, 'Validation failed', formatZodIssues(parsed.error));
  }

  const updated = await teams.update({ ...team, name: parsed.data.name });
  return c.json(updated, 200);
});

// DELETE /teams/:id — delete a team; team admin only, and only when empty of
// other members.
teamRoutes.delete('/:id', async (c) => {
  const { teams } = c.get('repositories');
  const user = getAuthenticatedUser(c);

  const team = await teams.findById(c.req.param('id'));
  if (!team) {
    return notFound(c, 'Team not found');
  }
  if (!isTeamAdmin(user.id, team)) {
    return forbidden(c, 'Only a team admin may delete this team');
  }
  if (team.memberIds.some((memberId) => memberId !== user.id)) {
    return conflict(
      c,
      'Team still has other members — remove them before deleting the team',
    );
  }

  await teams.delete(team.id);
  return c.body(null, 204);
});

// POST /teams/:id/members — add a member; team admin only.
teamRoutes.post('/:id/members', async (c) => {
  const { teams } = c.get('repositories');
  const user = getAuthenticatedUser(c);

  const team = await teams.findById(c.req.param('id'));
  if (!team) {
    return notFound(c, 'Team not found');
  }
  if (!isTeamAdmin(user.id, team)) {
    return forbidden(c, 'Only a team admin may add members to this team');
  }

  const parsed = addTeamMemberRequestSchema.safeParse(await readJsonBody(c));
  if (!parsed.success) {
    return badRequest(c, 'Validation failed', formatZodIssues(parsed.error));
  }
  if (team.memberIds.includes(parsed.data.userId)) {
    return conflict(c, 'User is already a member of this team');
  }

  const updated = await teams.addMember(team.id, parsed.data.userId);
  return c.json(updated, 200);
});

// DELETE /teams/:id/members/:userId — remove a member; team admin only. Removing
// the last admin is rejected by the repository (409).
teamRoutes.delete('/:id/members/:userId', async (c) => {
  const { teams } = c.get('repositories');
  const user = getAuthenticatedUser(c);

  const team = await teams.findById(c.req.param('id'));
  if (!team) {
    return notFound(c, 'Team not found');
  }
  if (!isTeamAdmin(user.id, team)) {
    return forbidden(c, 'Only a team admin may remove members from this team');
  }

  try {
    const updated = await teams.removeMember(team.id, c.req.param('userId'));
    return c.json(updated, 200);
  } catch (err) {
    if (err instanceof LastAdminError) {
      return conflict(c, 'Cannot remove the last admin from the team');
    }
    throw err;
  }
});
