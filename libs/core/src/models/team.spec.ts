import { describe, it, expect } from 'vitest';
import { validateTeam } from './team.js';

const adminId = '123e4567-e89b-12d3-a456-426614174000';
const memberId = '123e4567-e89b-12d3-a456-426614174001';

const validTeam = {
  id: '123e4567-e89b-12d3-a456-426614174002',
  name: 'Engineering',
  adminIds: [adminId],
  memberIds: [adminId, memberId],
  createdAt: '2024-01-01T10:00:00Z',
  updatedAt: '2024-01-01T10:00:00Z',
};

describe('validateTeam', () => {
  describe('valid teams', () => {
    it('accepts a valid team', () => {
      const result = validateTeam(validTeam);
      expect(result.success).toBe(true);
    });

    it('accepts a team where admin is the only member', () => {
      const result = validateTeam({
        ...validTeam,
        adminIds: [adminId],
        memberIds: [adminId],
      });
      expect(result.success).toBe(true);
    });

    it('trims leading/trailing whitespace from name', () => {
      const result = validateTeam({ ...validTeam, name: '  Engineering  ' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Engineering');
      }
    });
  });

  describe('id validation', () => {
    it('rejects invalid UUID', () => {
      const result = validateTeam({ ...validTeam, id: 'not-uuid' });
      expect(result.success).toBe(false);
    });
  });

  describe('name validation', () => {
    it('rejects empty name', () => {
      const result = validateTeam({ ...validTeam, name: '' });
      expect(result.success).toBe(false);
    });

    it('rejects blank-only name (whitespace)', () => {
      const result = validateTeam({ ...validTeam, name: '   ' });
      expect(result.success).toBe(false);
    });

    it('rejects name longer than 255 characters', () => {
      const result = validateTeam({ ...validTeam, name: 'a'.repeat(256) });
      expect(result.success).toBe(false);
    });

    it('accepts name at max length (255)', () => {
      const result = validateTeam({ ...validTeam, name: 'a'.repeat(255) });
      expect(result.success).toBe(true);
    });
  });

  describe('adminIds validation', () => {
    it('rejects empty adminIds array', () => {
      const result = validateTeam({ ...validTeam, adminIds: [] });
      expect(result.success).toBe(false);
    });

    it('rejects non-UUID entries in adminIds', () => {
      const result = validateTeam({ ...validTeam, adminIds: ['not-a-uuid'] });
      expect(result.success).toBe(false);
    });
  });

  describe('memberIds validation', () => {
    it('rejects empty memberIds array', () => {
      const result = validateTeam({ ...validTeam, memberIds: [] });
      expect(result.success).toBe(false);
    });

    it('rejects non-UUID entries in memberIds', () => {
      const result = validateTeam({ ...validTeam, memberIds: ['bad'] });
      expect(result.success).toBe(false);
    });
  });

  describe('adminIds ⊆ memberIds invariant', () => {
    it('rejects admin not present in memberIds', () => {
      const result = validateTeam({
        ...validTeam,
        adminIds: [adminId],
        memberIds: [memberId], // adminId is missing
      });
      expect(result.success).toBe(false);
    });

    it('rejects when one of multiple admins is not in memberIds', () => {
      const extraAdmin = '123e4567-e89b-12d3-a456-426614174099';
      const result = validateTeam({
        ...validTeam,
        adminIds: [adminId, extraAdmin],
        memberIds: [adminId, memberId], // extraAdmin missing
      });
      expect(result.success).toBe(false);
    });
  });
});
