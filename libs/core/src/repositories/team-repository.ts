import type { Team } from '../models/team.js';

export interface TeamRepository {
  findById(id: string): Promise<Team | null>;
  findAll(): Promise<Team[]>;
  create(team: Team): Promise<Team>;
  update(team: Team): Promise<Team>;
  delete(id: string): Promise<void>;
}
