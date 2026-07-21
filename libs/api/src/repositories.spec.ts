import { afterEach, describe, expect, it } from 'bun:test';
import type { SQL } from 'bun';
import {
  createRepositories,
  getRepositories,
  setRepositories,
  type Repositories,
} from './repositories.js';

afterEach(() => {
  // Never leave an override in place for other suites.
  setRepositories(undefined);
});

describe('createRepositories', () => {
  it('wires the shared repositories over one client', () => {
    // The repositories only store the client; constructing them opens nothing.
    const repos = createRepositories({} as SQL);
    expect(typeof repos.users.findByUsername).toBe('function');
    expect(typeof repos.timeEntries.findRunning).toBe('function');
    expect(typeof repos.teams.findByUserId).toBe('function');
  });
});

describe('getRepositories / setRepositories', () => {
  it('returns the override when one is set, without touching a database', () => {
    const fake = { users: {}, timeEntries: {}, teams: {} } as Repositories;
    setRepositories(fake);
    expect(getRepositories()).toBe(fake);
  });

  it('replaces the override when a new one is set', () => {
    const first = {} as Repositories;
    const second = {} as Repositories;
    setRepositories(first);
    expect(getRepositories()).toBe(first);
    setRepositories(second);
    expect(getRepositories()).toBe(second);
  });
});
