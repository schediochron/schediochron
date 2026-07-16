import { describe, expect, it } from 'bun:test';
import { validateTimeEntry } from '@schediochron/core';
import { app } from '../app.js';

const id = '88888888-8888-4888-8888-888888888888';

describe('GET /time-entries', () => {
  it('returns an array of valid entries', async () => {
    const res = await app.request('/time-entries');
    const body = (await res.json()) as unknown[];

    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    for (const entry of body) {
      expect(validateTimeEntry(entry).success).toBe(true);
    }
  });
});

describe('POST /time-entries', () => {
  it('returns a valid completed entry', async () => {
    const res = await app.request('/time-entries', { method: 'POST' });
    const body = (await res.json()) as { status: string };

    expect(validateTimeEntry(body).success).toBe(true);
    expect(body.status).toBe('completed');
  });
});

describe('POST /time-entries/start', () => {
  it('returns a valid running entry', async () => {
    const res = await app.request('/time-entries/start', { method: 'POST' });
    const body = (await res.json()) as {
      status: string;
      endTime: string | null;
    };

    expect(validateTimeEntry(body).success).toBe(true);
    expect(body.status).toBe('running');
    expect(body.endTime).toBeNull();
  });
});

describe('POST /time-entries/stop', () => {
  it('returns a valid completed entry', async () => {
    const res = await app.request('/time-entries/stop', { method: 'POST' });
    const body = (await res.json()) as {
      status: string;
      endTime: string | null;
    };

    expect(validateTimeEntry(body).success).toBe(true);
    expect(body.status).toBe('completed');
    expect(body.endTime).not.toBeNull();
  });
});

describe('GET /time-entries/:id', () => {
  it('returns a valid entry carrying the requested id', async () => {
    const res = await app.request(`/time-entries/${id}`);
    const body = (await res.json()) as { id: string };

    expect(validateTimeEntry(body).success).toBe(true);
    expect(body.id).toBe(id);
  });
});

describe('PATCH /time-entries/:id', () => {
  it('returns a valid entry carrying the requested id', async () => {
    const res = await app.request(`/time-entries/${id}`, { method: 'PATCH' });
    const body = (await res.json()) as { id: string };

    expect(validateTimeEntry(body).success).toBe(true);
    expect(body.id).toBe(id);
  });
});
