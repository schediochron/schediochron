import { describe, it, expect } from 'bun:test';
import type { Team } from '../models/team.js';
import type { TimeEntry } from '../models/time-entry.js';
import type { User } from '../models/user.js';
import type { RefreshToken } from '../models/refresh-token.js';
import type { CrudRepository } from './crud-repository.js';
import type { TeamRepository } from './team-repository.js';
import type { TimeEntryRepository } from './time-entry-repository.js';
import type { UserRepository } from './user-repository.js';
import type { RefreshTokenRepository } from './refresh-token-repository.js';

/**
 * These interfaces have no runtime, so the assertions that matter here are the
 * type annotations, checked by `tsc -b`, not the `expect` calls. The stubs
 * below are conformance fixtures: they compile only while each interface stays
 * implementable and substitutable for its base. Real behaviour is the
 * adapters' to test.
 */

const timeEntryRepository: TimeEntryRepository = {
  findById: async () => null,
  findAll: async () => [],
  create: async (item) => item,
  update: async (item) => item,
  delete: async () => {},
  findRunning: async () => null,
  find: async () => [],
};

const userRepository: UserRepository = {
  findById: async () => null,
  findAll: async () => [],
  create: async (item) => item,
  update: async (item) => item,
  delete: async () => {},
  findByUsername: async () => null,
};

const team: Team = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Engineering',
  adminIds: ['123e4567-e89b-12d3-a456-426614174001'],
  memberIds: ['123e4567-e89b-12d3-a456-426614174001'],
  createdAt: '2024-01-01T10:00:00Z',
  updatedAt: '2024-01-01T10:00:00Z',
};

const teamRepository: TeamRepository = {
  findById: async () => null,
  findAll: async () => [],
  create: async (item) => item,
  update: async (item) => item,
  delete: async () => {},
  findByUserId: async () => [],
  addMember: async () => team,
  removeMember: async () => team,
  assignAdmin: async () => team,
  removeAdmin: async () => team,
};

const refreshTokenRepository: RefreshTokenRepository = {
  create: async (token) => token,
  findByToken: async () => null,
  revoke: async () => {},
  revokeAllForUser: async () => {},
};

describe('repository interfaces', () => {
  describe('substitutability', () => {
    it('TimeEntryRepository stands in for CrudRepository<TimeEntry>', () => {
      const base: CrudRepository<TimeEntry> = timeEntryRepository;
      expect(base.findAll).toBeDefined();
    });

    it('UserRepository stands in for CrudRepository<User>', () => {
      const base: CrudRepository<User> = userRepository;
      expect(base.findAll).toBeDefined();
    });

    it('TeamRepository stands in for CrudRepository<Team>', () => {
      const base: CrudRepository<Team> = teamRepository;
      expect(base.findAll).toBeDefined();
    });

    it('findAll takes no arguments on any repository', async () => {
      // A subtype adding a required parameter here would not compile.
      await expect(timeEntryRepository.findAll()).resolves.toEqual([]);
      await expect(userRepository.findAll()).resolves.toEqual([]);
      await expect(teamRepository.findAll()).resolves.toEqual([]);
    });
  });

  describe('absence is representable', () => {
    it('findRunning may answer null', async () => {
      const running: TimeEntry | null =
        await timeEntryRepository.findRunning('user-id');
      expect(running).toBeNull();
    });

    it('findByUsername may answer null', async () => {
      const user: User | null = await userRepository.findByUsername('nobody');
      expect(user).toBeNull();
    });

    it('findByToken may answer null', async () => {
      const token: RefreshToken | null =
        await refreshTokenRepository.findByToken('unknown');
      expect(token).toBeNull();
    });
  });

  describe('TimeEntryRepository.find', () => {
    it('accepts an empty filter', async () => {
      await expect(timeEntryRepository.find({})).resolves.toEqual([]);
    });

    it('accepts each criterion independently', async () => {
      await expect(
        timeEntryRepository.find({ userId: 'user-id' }),
      ).resolves.toEqual([]);
      await expect(
        timeEntryRepository.find({ status: 'running' }),
      ).resolves.toEqual([]);
      await expect(
        timeEntryRepository.find({
          from: '2024-01-01T00:00:00Z',
          to: '2024-01-31T23:59:00Z',
        }),
      ).resolves.toEqual([]);
    });
  });
});
