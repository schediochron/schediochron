import { describe, expect, it } from 'bun:test';
import { computeDuration, validateTimeEntry } from '@schediochron/core';
import type { TimeEntry } from '@schediochron/core';
import { app } from '../app.js';

describe('GET /reports/hours', () => {
  it('returns an array of daily summaries', async () => {
    const res = await app.request('/reports/hours');
    const body = (await res.json()) as unknown[];

    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it('shapes each day as date, totalMinutes and valid entries', async () => {
    const res = await app.request('/reports/hours');
    const body = (await res.json()) as {
      date: string;
      totalMinutes: number;
      entries: unknown[];
    }[];

    for (const day of body) {
      expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isInteger(day.totalMinutes)).toBe(true);
      expect(day.totalMinutes).toBeGreaterThanOrEqual(0);
      for (const entry of day.entries) {
        expect(validateTimeEntry(entry).success).toBe(true);
      }
    }
  });

  it('reports totalMinutes consistent with the entries it lists', async () => {
    const res = await app.request('/reports/hours');
    const body = (await res.json()) as {
      totalMinutes: number;
      entries: TimeEntry[];
    }[];

    for (const day of body) {
      const summed = day.entries.reduce(
        (total, entry) => total + (computeDuration(entry) ?? 0) / 60_000,
        0,
      );
      expect(summed).toBe(day.totalMinutes);
    }
  });
});
