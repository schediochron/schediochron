import { describe, it, expect } from 'vitest';
import { validateUser } from './user.js';

const validUser = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  username: 'john_doe',
  displayName: 'John Doe',
  email: 'john@example.com',
  role: 'member' as const,
  createdAt: '2024-01-01T10:00:00Z',
  updatedAt: '2024-01-01T10:00:00Z',
};

describe('validateUser', () => {
  describe('valid users', () => {
    it('accepts a valid member', () => {
      const result = validateUser(validUser);
      expect(result.success).toBe(true);
    });

    it('accepts a valid admin', () => {
      const result = validateUser({ ...validUser, role: 'admin' });
      expect(result.success).toBe(true);
    });

    it('accepts null displayName', () => {
      const result = validateUser({ ...validUser, displayName: null });
      expect(result.success).toBe(true);
    });

    it('accepts null email', () => {
      const result = validateUser({ ...validUser, email: null });
      expect(result.success).toBe(true);
    });

    it('accepts both displayName and email as null', () => {
      const result = validateUser({
        ...validUser,
        displayName: null,
        email: null,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('id validation', () => {
    it('rejects invalid UUID', () => {
      const result = validateUser({ ...validUser, id: 'not-a-uuid' });
      expect(result.success).toBe(false);
    });
  });

  describe('username validation', () => {
    it('rejects username shorter than 3 characters', () => {
      const result = validateUser({ ...validUser, username: 'ab' });
      expect(result.success).toBe(false);
    });

    it('rejects username longer than 50 characters', () => {
      const result = validateUser({ ...validUser, username: 'a'.repeat(51) });
      expect(result.success).toBe(false);
    });

    it('accepts username at min length (3)', () => {
      const result = validateUser({ ...validUser, username: 'abc' });
      expect(result.success).toBe(true);
    });

    it('accepts username at max length (50)', () => {
      const result = validateUser({ ...validUser, username: 'a'.repeat(50) });
      expect(result.success).toBe(true);
    });

    it('rejects username with spaces', () => {
      const result = validateUser({ ...validUser, username: 'john doe' });
      expect(result.success).toBe(false);
    });

    it('rejects username with special characters', () => {
      const result = validateUser({ ...validUser, username: 'john@doe!' });
      expect(result.success).toBe(false);
    });

    it('accepts username with hyphens and underscores', () => {
      const result = validateUser({ ...validUser, username: 'john-doe_123' });
      expect(result.success).toBe(true);
    });
  });

  describe('displayName validation', () => {
    it('rejects empty string displayName (must be null)', () => {
      const result = validateUser({ ...validUser, displayName: '' });
      expect(result.success).toBe(false);
    });

    it('rejects displayName longer than 100 characters', () => {
      const result = validateUser({
        ...validUser,
        displayName: 'a'.repeat(101),
      });
      expect(result.success).toBe(false);
    });

    it('accepts displayName at max length (100)', () => {
      const result = validateUser({
        ...validUser,
        displayName: 'a'.repeat(100),
      });
      expect(result.success).toBe(true);
    });
  });

  describe('email validation', () => {
    it('rejects invalid email format', () => {
      const result = validateUser({ ...validUser, email: 'not-an-email' });
      expect(result.success).toBe(false);
    });

    it('rejects empty string email (must be null)', () => {
      const result = validateUser({ ...validUser, email: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('role validation', () => {
    it('rejects unknown role', () => {
      const result = validateUser({ ...validUser, role: 'superadmin' });
      expect(result.success).toBe(false);
    });
  });
});
