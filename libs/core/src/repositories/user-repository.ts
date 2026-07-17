import type { User } from '../models/user.js';
import type { CrudRepository } from './crud-repository.js';

export interface UserRepository extends CrudRepository<User> {
  /**
   * Finds a user by username (unique). Useful for Auth.
   */
  findByUsername(username: string): Promise<User | null>;
}
