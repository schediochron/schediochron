import { describe, it, expect } from 'bun:test';
import { validateTimeEntry } from './time-entry.js';

const validEntry = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  userId: '123e4567-e89b-12d3-a456-426614174001',
  startTime: '2024-01-01T10:00:00Z',
  endTime: '2024-01-01T11:00:00Z',
  status: 'completed' as const,
  note: 'Focus session',
  createdAt: '2024-01-01T10:00:00Z',
  updatedAt: '2024-01-01T11:00:00Z',
};

const validRunningEntry = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  userId: '123e4567-e89b-12d3-a456-426614174001',
  startTime: '2024-01-01T10:00:00Z',
  endTime: null,
  status: 'running' as const,
  note: null,
  createdAt: '2024-01-01T10:00:00Z',
  updatedAt: '2024-01-01T10:00:00Z',
};

describe('validateTimeEntry', () => {
  describe('valid entries', () => {
    it('accepts a valid completed entry', () => {
      const result = validateTimeEntry(validEntry);
      expect(result.success).toBe(true);
    });

    it('accepts a valid running entry', () => {
      const result = validateTimeEntry(validRunningEntry);
      expect(result.success).toBe(true);
    });

    it('accepts null note', () => {
      const result = validateTimeEntry({ ...validEntry, note: null });
      expect(result.success).toBe(true);
    });

    it('accepts note at max length (255 chars)', () => {
      const result = validateTimeEntry({
        ...validEntry,
        note: 'a'.repeat(255),
      });
      expect(result.success).toBe(true);
    });
  });

  describe('id and userId validation', () => {
    it('rejects invalid UUID for id', () => {
      const result = validateTimeEntry({ ...validEntry, id: 'not-a-uuid' });
      expect(result.success).toBe(false);
    });

    it('rejects invalid UUID for userId', () => {
      const result = validateTimeEntry({ ...validEntry, userId: 'bad' });
      expect(result.success).toBe(false);
    });
  });

  describe('startTime / endTime validation', () => {
    it('rejects startTime with non-zero seconds', () => {
      const result = validateTimeEntry({
        ...validEntry,
        startTime: '2024-01-01T10:00:45Z',
      });
      expect(result.success).toBe(false);
    });

    it('rejects endTime with non-zero seconds', () => {
      const result = validateTimeEntry({
        ...validEntry,
        endTime: '2024-01-01T11:00:30Z',
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-ISO startTime', () => {
      const result = validateTimeEntry({
        ...validEntry,
        startTime: '01/01/2024 10:00',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('status / endTime invariants', () => {
    it('rejects running status with a non-null endTime', () => {
      const result = validateTimeEntry({
        ...validRunningEntry,
        endTime: '2024-01-01T11:00:00Z',
      });
      expect(result.success).toBe(false);
    });

    it('rejects completed status with null endTime', () => {
      const result = validateTimeEntry({ ...validEntry, endTime: null });
      expect(result.success).toBe(false);
    });

    it('rejects endTime equal to startTime', () => {
      const result = validateTimeEntry({
        ...validEntry,
        endTime: validEntry.startTime,
      });
      expect(result.success).toBe(false);
    });

    it('rejects endTime before startTime', () => {
      const result = validateTimeEntry({
        ...validEntry,
        endTime: '2024-01-01T09:00:00Z',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('note validation', () => {
    it('rejects note exceeding 255 characters', () => {
      const result = validateTimeEntry({
        ...validEntry,
        note: 'a'.repeat(256),
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty string note (must be null)', () => {
      const result = validateTimeEntry({ ...validEntry, note: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('status validation', () => {
    it('rejects unknown status value', () => {
      const result = validateTimeEntry({ ...validEntry, status: 'deleted' });
      expect(result.success).toBe(false);
    });
  });
});
