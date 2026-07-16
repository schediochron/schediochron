import { describe, it, expect } from 'bun:test';
import { validateRefreshToken, isRefreshTokenActive } from './refresh-token.js';

const validToken = {
  token: 'e8b7c1a0f4d24e9b8a1c3f5d7e9b0a2c',
  userId: '123e4567-e89b-12d3-a456-426614174000',
  expiresAt: '2024-01-08T10:00:00Z',
  revokedAt: null,
};

describe('validateRefreshToken', () => {
  describe('valid tokens', () => {
    it('accepts a live token', () => {
      const result = validateRefreshToken(validToken);
      expect(result.success).toBe(true);
    });

    it('accepts a revoked token', () => {
      const result = validateRefreshToken({
        ...validToken,
        revokedAt: '2024-01-02T10:00:00Z',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('token validation', () => {
    it('rejects an empty token', () => {
      const result = validateRefreshToken({ ...validToken, token: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('userId validation', () => {
    it('rejects invalid UUID', () => {
      const result = validateRefreshToken({ ...validToken, userId: 'nope' });
      expect(result.success).toBe(false);
    });
  });

  describe('timestamp validation', () => {
    it('rejects non-ISO expiresAt', () => {
      const result = validateRefreshToken({
        ...validToken,
        expiresAt: '08/01/2024',
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-ISO revokedAt', () => {
      const result = validateRefreshToken({
        ...validToken,
        revokedAt: 'yesterday',
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('isRefreshTokenActive', () => {
  const now = new Date('2024-01-01T10:00:00Z');

  it('accepts a token that is unrevoked and unexpired', () => {
    expect(isRefreshTokenActive(validToken, now)).toBe(true);
  });

  it('rejects a token past its expiry', () => {
    expect(
      isRefreshTokenActive(
        { ...validToken, expiresAt: '2023-12-31T10:00:00Z' },
        now,
      ),
    ).toBe(false);
  });

  it('rejects a token expiring exactly now', () => {
    expect(
      isRefreshTokenActive(
        { ...validToken, expiresAt: '2024-01-01T10:00:00Z' },
        now,
      ),
    ).toBe(false);
  });

  it('rejects a revoked token that has not yet expired', () => {
    expect(
      isRefreshTokenActive(
        { ...validToken, revokedAt: '2023-12-31T10:00:00Z' },
        now,
      ),
    ).toBe(false);
  });

  it('rejects a token that is both revoked and expired', () => {
    expect(
      isRefreshTokenActive(
        {
          ...validToken,
          expiresAt: '2023-12-30T10:00:00Z',
          revokedAt: '2023-12-31T10:00:00Z',
        },
        now,
      ),
    ).toBe(false);
  });
});
