import type { Team } from '../models/team.js';
import type { CrudRepository } from './crud-repository.js';

/**
 * Teams and their membership.
 *
 * The membership mutations are separate operations rather than `update(team)`
 * calls because each must hold `adminIds ⊆ memberIds` and `adminIds` non-empty
 * atomically — a read-modify-write cannot.
 */
export interface TeamRepository extends CrudRepository<Team> {
  /** Teams the user participates in, by `memberIds`. Empty is normal. */
  findByUserId(userId: string): Promise<Team[]>;

  /** Adds to `memberIds` without admin rights. Already a member is a no-op. */
  addMember(teamId: string, userId: string): Promise<Team>;

  /**
   * Removes from `memberIds` and, if present, `adminIds`.
   * Rejects removing the last admin.
   */
  removeMember(teamId: string, userId: string): Promise<Team>;

  /** Adds to `adminIds`, and to `memberIds` if absent. Both or neither. */
  assignAdmin(teamId: string, userId: string): Promise<Team>;

  /** Removes from `adminIds`, leaving membership. Rejects the last admin. */
  removeAdmin(teamId: string, userId: string): Promise<Team>;
}
