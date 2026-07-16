import type {
  HoursReportDay,
  Team,
  TimeEntry,
  TokenPair,
  User,
} from '@schediochron/core';

/**
 * Fixed sample payloads backing the stub routes, shaped exactly like the real
 * responses will be (see `openapi.yaml`). Phase 2 replaces these with data from
 * the repositories in `@schediochron/core`; nothing outside the route handlers
 * should depend on them.
 *
 * Values are constant rather than generated so responses stay deterministic.
 */

export const stubUser: User = {
  id: '11111111-1111-4111-8111-111111111111',
  username: 'ada',
  displayName: 'Ada Lovelace',
  email: 'ada@example.com',
  role: 'admin',
  createdAt: '2026-01-05T08:00:00Z',
  updatedAt: '2026-01-05T08:00:00Z',
};

export const stubTokenPair: TokenPair = {
  accessToken: 'stub.access.token',
  refreshToken: 'stub-refresh-token',
};

export const stubCompletedEntry: TimeEntry = {
  id: '33333333-3333-4333-8333-333333333333',
  userId: stubUser.id,
  startTime: '2026-01-05T09:00:00Z',
  endTime: '2026-01-05T11:30:00Z',
  status: 'completed',
  note: 'Analytical engine design',
  createdAt: '2026-01-05T09:00:00Z',
  updatedAt: '2026-01-05T11:30:00Z',
};

export const stubRunningEntry: TimeEntry = {
  id: '44444444-4444-4444-8444-444444444444',
  userId: stubUser.id,
  startTime: '2026-01-05T13:00:00Z',
  endTime: null,
  status: 'running',
  note: null,
  createdAt: '2026-01-05T13:00:00Z',
  updatedAt: '2026-01-05T13:00:00Z',
};

export const stubTeam: Team = {
  id: '55555555-5555-4555-8555-555555555555',
  name: 'Engineering',
  adminIds: [stubUser.id],
  memberIds: [stubUser.id, '22222222-2222-4222-8222-222222222222'],
  createdAt: '2026-01-05T08:00:00Z',
  updatedAt: '2026-01-05T08:00:00Z',
};

export const stubHoursReportDay: HoursReportDay = {
  date: '2026-01-05',
  totalMinutes: 150, // matches stubCompletedEntry: 09:00 → 11:30
  entries: [stubCompletedEntry],
};
