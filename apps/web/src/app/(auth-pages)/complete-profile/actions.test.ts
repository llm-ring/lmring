import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockAuthInstance,
  mockDbInstance,
  mockIsPlaceholderEmail,
  mockCreateEmailService,
  mockEnv,
  mockHeaders,
} = vi.hoisted(() => {
  const mockSession = {
    session: {
      id: 'test-session-id',
      userId: 'test-user-id',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      token: 'test-token',
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    user: {
      id: 'test-user-id',
      email: 'placeholder@users.noreply.lmring.local',
      emailVerified: false,
      name: 'Test User',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  return {
    mockAuthInstance: {
      api: {
        getSession: vi.fn().mockResolvedValue(mockSession),
        createVerificationOTP: vi.fn().mockResolvedValue('123456'),
      },
    },
    mockDbInstance: {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    },
    mockIsPlaceholderEmail: vi.fn().mockReturnValue(true),
    mockCreateEmailService: vi.fn(),
    mockEnv: {
      RESEND_API_KEY: 're_test',
      NEXT_PUBLIC_EMAIL_ENABLED: 'true',
      EMAIL_FROM: 'noreply@example.com',
    },
    mockHeaders: vi.fn().mockResolvedValue(new Headers()),
  };
});

vi.mock('@/libs/Auth', () => ({
  auth: mockAuthInstance,
}));

vi.mock('@lmring/database', () => ({
  db: mockDbInstance,
  and: vi.fn(),
  eq: vi.fn(),
  ne: vi.fn(),
  session: { userId: 'userId', updatedAt: 'updatedAt' },
  users: { id: 'id', email: 'email', emailVerified: 'emailVerified', updatedAt: 'updatedAt' },
  verification: { id: 'id', identifier: 'identifier', value: 'value', expiresAt: 'expiresAt' },
}));

vi.mock('@lmring/auth/placeholder-email', () => ({
  isPlaceholderEmail: mockIsPlaceholderEmail,
}));

vi.mock('@lmring/auth/email', () => ({
  createEmailService: mockCreateEmailService,
}));

vi.mock('@lmring/env', () => ({
  env: mockEnv,
}));

vi.mock('next/headers', () => ({
  headers: mockHeaders,
}));

import { sendProfileOTP, updateProfileEmail, verifyProfileOTP } from './actions';

function resetDb() {
  mockDbInstance.select.mockReset().mockReturnValue(mockDbInstance);
  mockDbInstance.from.mockReset().mockReturnValue(mockDbInstance);
  mockDbInstance.where.mockReset().mockReturnValue(mockDbInstance);
  mockDbInstance.delete.mockReset().mockReturnValue(mockDbInstance);
  mockDbInstance.update.mockReset().mockReturnValue(mockDbInstance);
  mockDbInstance.set.mockReset().mockReturnValue(mockDbInstance);
}

describe('complete-profile actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDb();
    mockIsPlaceholderEmail.mockReturnValue(true);
    mockEnv.RESEND_API_KEY = 're_test';
    mockEnv.NEXT_PUBLIC_EMAIL_ENABLED = 'true';
    mockAuthInstance.api.getSession.mockResolvedValue({
      session: { id: 's' },
      user: {
        id: 'test-user-id',
        email: 'placeholder@users.noreply.lmring.local',
        name: 'Test',
      },
    });
    mockAuthInstance.api.createVerificationOTP.mockResolvedValue('123456');
  });

  describe('sendProfileOTP', () => {
    it('returns error when not authenticated', async () => {
      mockAuthInstance.api.getSession.mockResolvedValueOnce(null);
      await expect(sendProfileOTP('a@b.com')).resolves.toEqual({
        success: false,
        error: 'Not authenticated',
      });
    });

    it('returns error when profile already completed', async () => {
      mockIsPlaceholderEmail.mockReturnValueOnce(false);
      await expect(sendProfileOTP('a@b.com')).resolves.toEqual({
        success: false,
        error: 'Profile already completed',
      });
    });

    it('returns error for invalid email', async () => {
      await expect(sendProfileOTP('not-an-email')).resolves.toEqual({
        success: false,
        error: 'Invalid email address',
      });
    });

    it('returns error when email service is not configured', async () => {
      mockEnv.RESEND_API_KEY = '';
      await expect(sendProfileOTP('a@b.com')).resolves.toEqual({
        success: false,
        error: 'Email service is not configured',
      });
    });

    it('sends OTP successfully', async () => {
      const sendOTP = vi.fn().mockResolvedValue({ success: true });
      mockCreateEmailService.mockReturnValue({ sendOTP });

      await expect(sendProfileOTP('user@example.com')).resolves.toEqual({ success: true });
      expect(mockAuthInstance.api.createVerificationOTP).toHaveBeenCalled();
      expect(sendOTP).toHaveBeenCalledWith({
        email: 'user@example.com',
        otp: '123456',
        type: 'email-verification',
      });
    });

    it('returns error when OTP generation fails', async () => {
      mockAuthInstance.api.createVerificationOTP.mockResolvedValueOnce('');
      await expect(sendProfileOTP('user@example.com')).resolves.toEqual({
        success: false,
        error: 'Failed to generate verification code',
      });
    });

    it('returns error when email send fails', async () => {
      mockCreateEmailService.mockReturnValue({
        sendOTP: vi.fn().mockResolvedValue({ success: false, error: 'bounce' }),
      });
      await expect(sendProfileOTP('user@example.com')).resolves.toEqual({
        success: false,
        error: 'bounce',
      });
    });

    it('returns error on thrown exception', async () => {
      mockAuthInstance.api.createVerificationOTP.mockRejectedValueOnce(new Error('otp boom'));
      await expect(sendProfileOTP('user@example.com')).resolves.toEqual({
        success: false,
        error: 'otp boom',
      });
    });
  });

  describe('verifyProfileOTP', () => {
    it('returns error when not authenticated', async () => {
      mockAuthInstance.api.getSession.mockResolvedValueOnce(null);
      await expect(verifyProfileOTP('a@b.com', '123456')).resolves.toEqual({
        success: false,
        error: 'Not authenticated',
      });
    });

    it('returns error for invalid otp length', async () => {
      await expect(verifyProfileOTP('a@b.com', '123')).resolves.toEqual({
        success: false,
        error: 'Invalid verification code',
      });
    });

    it('returns error when verification record missing', async () => {
      mockDbInstance.where.mockResolvedValueOnce([]);
      await expect(verifyProfileOTP('a@b.com', '123456')).resolves.toEqual({
        success: false,
        error: 'Verification code not found. Please request a new code.',
      });
    });

    it('returns error when OTP expired', async () => {
      mockDbInstance.where
        .mockResolvedValueOnce([
          {
            id: 'v1',
            value: '123456:0',
            expiresAt: new Date(Date.now() - 1000),
          },
        ])
        .mockResolvedValueOnce(undefined); // delete

      await expect(verifyProfileOTP('a@b.com', '123456')).resolves.toEqual({
        success: false,
        error: 'Verification code has expired. Please request a new code.',
      });
    });

    it('returns error after too many attempts', async () => {
      mockDbInstance.where
        .mockResolvedValueOnce([
          {
            id: 'v1',
            value: '123456:5',
            expiresAt: new Date(Date.now() + 60_000),
          },
        ])
        .mockResolvedValueOnce(undefined);

      await expect(verifyProfileOTP('a@b.com', '000000')).resolves.toEqual({
        success: false,
        error: 'Too many failed attempts. Please request a new code.',
      });
    });

    it('increments attempts on wrong OTP', async () => {
      mockDbInstance.where
        .mockResolvedValueOnce([
          {
            id: 'v1',
            value: '123456:1',
            expiresAt: new Date(Date.now() + 60_000),
          },
        ])
        .mockReturnValueOnce(mockDbInstance); // update chain continues via set/where

      // After wrong OTP: update().set().where()
      mockDbInstance.set.mockReturnValueOnce(mockDbInstance);
      mockDbInstance.where.mockResolvedValueOnce(undefined);

      await expect(verifyProfileOTP('a@b.com', '000000')).resolves.toEqual({
        success: false,
        error: 'Invalid verification code',
      });
      expect(mockDbInstance.set).toHaveBeenCalledWith({ value: '123456:2' });
    });

    it('returns error when email already in use', async () => {
      // select verification records
      mockDbInstance.where
        .mockResolvedValueOnce([
          {
            id: 'v1',
            value: '123456:0',
            expiresAt: new Date(Date.now() + 60_000),
          },
        ])
        // delete verification
        .mockResolvedValueOnce(undefined)
        // existing user check
        .mockResolvedValueOnce([{ id: 'other-user' }]);

      await expect(verifyProfileOTP('a@b.com', '123456')).resolves.toEqual({
        success: false,
        error: 'This email address is already in use',
      });
    });

    it('verifies OTP and updates user email', async () => {
      mockDbInstance.where
        .mockResolvedValueOnce([
          {
            id: 'v1',
            value: '123456:0',
            expiresAt: new Date(Date.now() + 60_000),
          },
        ])
        // delete verification
        .mockResolvedValueOnce(undefined)
        // existing user check empty
        .mockResolvedValueOnce([])
        // update users where
        .mockResolvedValueOnce(undefined)
        // update session where
        .mockResolvedValueOnce(undefined);

      mockDbInstance.set.mockReturnValue(mockDbInstance);

      await expect(verifyProfileOTP('User@Example.com', '123456')).resolves.toEqual({
        success: true,
      });
      expect(mockDbInstance.update).toHaveBeenCalled();
    });
  });

  describe('updateProfileEmail', () => {
    it('returns error when not authenticated', async () => {
      mockAuthInstance.api.getSession.mockResolvedValueOnce(null);
      await expect(updateProfileEmail('a@b.com')).resolves.toEqual({
        success: false,
        error: 'Not authenticated',
      });
    });

    it('returns error for invalid email', async () => {
      await expect(updateProfileEmail('bad')).resolves.toEqual({
        success: false,
        error: 'Invalid email address',
      });
    });

    it('returns error when email already used', async () => {
      mockDbInstance.where.mockResolvedValueOnce([{ id: 'other' }]);
      await expect(updateProfileEmail('taken@example.com')).resolves.toEqual({
        success: false,
        error: 'This email address is already in use',
      });
    });

    it('updates email without verification', async () => {
      mockDbInstance.where
        .mockResolvedValueOnce([]) // uniqueness
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);
      mockDbInstance.set.mockReturnValue(mockDbInstance);

      await expect(updateProfileEmail('new@example.com')).resolves.toEqual({ success: true });
      expect(mockDbInstance.set).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          emailVerified: false,
        }),
      );
    });

    it('returns error on exception', async () => {
      mockDbInstance.where.mockRejectedValueOnce(new Error('db down'));
      await expect(updateProfileEmail('a@b.com')).resolves.toEqual({
        success: false,
        error: 'db down',
      });
    });
  });
});
