import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockSend, MockResend } = vi.hoisted(() => {
  const mockSend = vi.fn();
  const MockResend = vi.fn(function MockResend(this: { emails: { send: typeof mockSend } }) {
    this.emails = { send: mockSend };
  });
  return { mockSend, MockResend };
});

vi.mock('resend', () => ({
  Resend: MockResend,
}));

import { createEmailService } from './email';
import type { OTPType } from './email';

describe('createEmailService', () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  const config = {
    resendApiKey: 're_test_key',
    emailFrom: 'noreply@lmring.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({ data: { id: 'email-123' }, error: null });
  });

  it('creates a Resend client with the provided API key', () => {
    createEmailService(config, mockLogger);

    expect(MockResend).toHaveBeenCalledWith('re_test_key');
  });

  const otpTypes: Array<{ type: OTPType; subject: string; textSnippet: string }> = [
    {
      type: 'sign-in',
      subject: 'Your LMRing Sign-in Code',
      textSnippet: "You're signing in to your LMRing account",
    },
    {
      type: 'email-verification',
      subject: 'Verify Your LMRing Email',
      textSnippet: 'Please verify your email address to complete your LMRing account setup',
    },
    {
      type: 'forget-password',
      subject: 'Reset Your LMRing Password',
      textSnippet: 'You requested to reset your LMRing password',
    },
    {
      type: 'change-email',
      subject: 'Verify Your New LMRing Email',
      textSnippet: 'You requested to change your LMRing email address',
    },
  ];

  describe.each(otpTypes)('OTP type: $type', ({ type, subject, textSnippet }) => {
    it('sends email with correct subject and OTP content on success', async () => {
      const service = createEmailService(config, mockLogger);
      const otp = '123456';
      const email = 'user@example.com';

      const result = await service.sendOTP({ email, otp, type });

      expect(result).toEqual({ success: true });
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@lmring.com',
          to: email,
          subject,
        }),
      );

      const sendArgs = mockSend.mock.calls[0][0];
      expect(sendArgs.text).toContain(otp);
      expect(sendArgs.text).toContain(textSnippet);
      expect(sendArgs.text).toContain('This code will expire in 10 minutes');
      expect(sendArgs.html).toContain(otp);
      expect(sendArgs.html).toContain(subject);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Sending OTP email',
        expect.objectContaining({
          email: 'us***@example.com',
          type,
        }),
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'OTP email sent successfully',
        expect.objectContaining({
          emailId: 'email-123',
          type,
        }),
      );
    });
  });

  it('uses default subject and base text for unknown OTP type', async () => {
    const service = createEmailService(config, mockLogger);
    const otp = '999999';

    const result = await service.sendOTP({
      email: 'user@example.com',
      otp,
      type: 'unknown-type' as OTPType,
    });

    expect(result).toEqual({ success: true });
    const sendArgs = mockSend.mock.calls[0][0];
    expect(sendArgs.subject).toBe('Your LMRing Verification Code');
    expect(sendArgs.text).toContain(`Your verification code is: ${otp}`);
    expect(sendArgs.html).toContain(otp);
  });

  it('returns failure when Resend reports an error', async () => {
    mockSend.mockResolvedValueOnce({
      data: null,
      error: { message: 'Invalid API key', name: 'validation_error' },
    });

    const service = createEmailService(config, mockLogger);
    const result = await service.sendOTP({
      email: 'user@example.com',
      otp: '123456',
      type: 'sign-in',
    });

    expect(result).toEqual({ success: false, error: 'Invalid API key' });
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to send OTP email',
      expect.objectContaining({
        error: 'Invalid API key',
        type: 'sign-in',
      }),
    );
  });

  it('returns failure when Resend throws an Error', async () => {
    mockSend.mockRejectedValueOnce(new Error('Network timeout'));

    const service = createEmailService(config, mockLogger);
    const result = await service.sendOTP({
      email: 'ab@example.com',
      otp: '654321',
      type: 'forget-password',
    });

    expect(result).toEqual({ success: false, error: 'Network timeout' });
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Exception while sending OTP email',
      expect.objectContaining({
        error: 'Network timeout',
        type: 'forget-password',
      }),
    );
  });

  it('returns failure with Unknown error when a non-Error is thrown', async () => {
    mockSend.mockRejectedValueOnce('string-failure');

    const service = createEmailService(config, mockLogger);
    const result = await service.sendOTP({
      email: 'user@example.com',
      otp: '111111',
      type: 'email-verification',
    });

    expect(result).toEqual({ success: false, error: 'Unknown error' });
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Exception while sending OTP email',
      expect.objectContaining({
        error: 'Unknown error',
        type: 'email-verification',
      }),
    );
  });

  it('masks email addresses in logs', async () => {
    const service = createEmailService(config, mockLogger);

    await service.sendOTP({
      email: 'john.doe@company.com',
      otp: '123456',
      type: 'sign-in',
    });

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Sending OTP email',
      expect.objectContaining({
        email: 'jo***@company.com',
      }),
    );
  });

  it('includes type-specific HTML headings for each OTP type', async () => {
    const service = createEmailService(config, mockLogger);
    const expectations: Array<{ type: OTPType; heading: string; body: string }> = [
      {
        type: 'sign-in',
        heading: 'Sign-in Verification',
        body: "You're signing in to your LMRing account.",
      },
      {
        type: 'email-verification',
        heading: 'Email Verification',
        body: 'Please verify your email address to complete your account setup.',
      },
      {
        type: 'change-email',
        heading: 'Email Change Verification',
        body: 'Please verify your new email address.',
      },
      {
        type: 'forget-password',
        heading: 'Password Reset',
        body: 'You requested to reset your password.',
      },
    ];

    for (const { type, heading, body } of expectations) {
      mockSend.mockClear();
      await service.sendOTP({ email: 'user@example.com', otp: '123456', type });
      const html = mockSend.mock.calls[0][0].html as string;
      expect(html).toContain(heading);
      expect(html).toContain(body);
    }
  });

  it('uses the default logger when none is provided', async () => {
    const service = createEmailService(config);
    const result = await service.sendOTP({
      email: 'user@example.com',
      otp: '123456',
      type: 'sign-in',
    });

    expect(result).toEqual({ success: true });
  });
});
