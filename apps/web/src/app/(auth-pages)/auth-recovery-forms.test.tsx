import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompleteProfileForm } from './complete-profile/CompleteProfileForm';
import { ForgotPasswordForm } from './forgot-password/ForgotPasswordForm';
import { VerifyEmailForm } from './verify-email/VerifyEmailForm';

const mocks = vi.hoisted(() => ({
  env: { NEXT_PUBLIC_EMAIL_ENABLED: 'true' },
  sendVerificationOtp: vi.fn(),
  resetPassword: vi.fn(),
  verifyEmail: vi.fn(),
  routerPush: vi.fn(),
  routerRefresh: vi.fn(),
  sendProfileOTP: vi.fn(),
  updateProfileEmail: vi.fn(),
  verifyProfileOTP: vi.fn(),
}));

vi.mock('@lmring/env', () => ({ env: mocks.env }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.routerPush, refresh: mocks.routerRefresh }),
}));

vi.mock('@/hooks/use-translations', () => ({
  useTranslations: () => (key: string, options?: { email?: string }) =>
    options?.email ? `${key}:${options.email}` : key,
}));

vi.mock('@/libs/AuthClient', () => ({
  authClient: {
    emailOtp: {
      sendVerificationOtp: mocks.sendVerificationOtp,
      resetPassword: mocks.resetPassword,
      verifyEmail: mocks.verifyEmail,
    },
  },
}));

vi.mock('./complete-profile/actions', () => ({
  sendProfileOTP: mocks.sendProfileOTP,
  updateProfileEmail: mocks.updateProfileEmail,
  verifyProfileOTP: mocks.verifyProfileOTP,
}));

function getFormByButtonName(name: string): HTMLFormElement {
  const form = screen.getByRole('button', { name }).closest('form');
  if (!(form instanceof HTMLFormElement)) {
    throw new Error(`Expected form for button "${name}"`);
  }
  return form;
}

function getNthButtonByName(name: string, index: number): HTMLElement {
  const button = screen.getAllByRole('button', { name })[index];
  if (!button) {
    throw new Error(`Expected button "${name}" at index ${index}`);
  }
  return button;
}

async function advanceForgotPasswordToVerify(): Promise<void> {
  render(<ForgotPasswordForm />);
  fireEvent.change(screen.getByLabelText('ForgotPassword.email_label'), {
    target: { value: 'person@example.com' },
  });
  fireEvent.submit(getFormByButtonName('ForgotPassword.send_code_button'));
  await screen.findByText('ForgotPassword.verify_title');
}

async function advanceCompleteProfileToVerify(): Promise<void> {
  render(<CompleteProfileForm userName="Ada" />);
  fireEvent.change(screen.getByLabelText('CompleteProfile.email_label'), {
    target: { value: 'ada@example.com' },
  });
  fireEvent.submit(getFormByButtonName('CompleteProfile.submit_button'));
  await screen.findByText('CompleteProfile.verify_title');
}

describe('ForgotPasswordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.env.NEXT_PUBLIC_EMAIL_ENABLED = 'true';
    mocks.sendVerificationOtp.mockResolvedValue({ data: {}, error: null });
    mocks.resetPassword.mockResolvedValue({ data: {}, error: null });
    mocks.verifyEmail.mockResolvedValue({ data: {}, error: null });
    mocks.sendProfileOTP.mockResolvedValue({ success: true });
    mocks.updateProfileEmail.mockResolvedValue({ success: true });
    mocks.verifyProfileOTP.mockResolvedValue({ success: true });
  });

  afterEach(() => cleanup());

  it('reports provider and unexpected errors while requesting a reset code', async () => {
    mocks.sendVerificationOtp.mockResolvedValueOnce({ error: { message: 'Unknown account' } });
    const { unmount } = render(<ForgotPasswordForm />);
    fireEvent.change(screen.getByLabelText('ForgotPassword.email_label'), {
      target: { value: 'missing@example.com' },
    });
    fireEvent.submit(getFormByButtonName('ForgotPassword.send_code_button'));
    expect(await screen.findByText('Unknown account')).toBeInTheDocument();
    unmount();

    mocks.sendVerificationOtp.mockRejectedValueOnce(new Error('network'));
    render(<ForgotPasswordForm />);
    fireEvent.change(screen.getByLabelText('ForgotPassword.email_label'), {
      target: { value: 'person@example.com' },
    });
    fireEvent.submit(getFormByButtonName('ForgotPassword.send_code_button'));
    expect(await screen.findByText('An unexpected error occurred')).toBeInTheDocument();
  });

  it('sanitizes the OTP, validates password matching, and toggles password visibility', async () => {
    await advanceForgotPasswordToVerify();
    const otpInput = screen.getByLabelText('ForgotPassword.otp_label');
    fireEvent.change(otpInput, { target: { value: 'a12b34567' } });
    expect(otpInput).toHaveValue('123456');

    const password = screen.getByLabelText('ForgotPassword.new_password_label');
    const confirmation = screen.getByLabelText('ForgotPassword.confirm_password_label');
    fireEvent.change(password, { target: { value: 'StrongPass1!' } });
    fireEvent.change(confirmation, { target: { value: 'Different1!' } });
    fireEvent.click(getNthButtonByName('Show password', 0));
    expect(password).toHaveAttribute('type', 'text');
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    fireEvent.click(getNthButtonByName('Show password', 1));
    fireEvent.submit(getFormByButtonName('ForgotPassword.reset_button'));
    expect(await screen.findByText('ForgotPassword.passwords_mismatch')).toBeInTheDocument();
    expect(mocks.resetPassword).not.toHaveBeenCalled();
  });

  it('rejects a weak password before calling the reset API', async () => {
    await advanceForgotPasswordToVerify();
    fireEvent.change(screen.getByLabelText('ForgotPassword.otp_label'), {
      target: { value: '123456' },
    });
    fireEvent.change(screen.getByLabelText('ForgotPassword.new_password_label'), {
      target: { value: 'weak' },
    });
    fireEvent.change(screen.getByLabelText('ForgotPassword.confirm_password_label'), {
      target: { value: 'weak' },
    });
    fireEvent.submit(getFormByButtonName('ForgotPassword.reset_button'));
    await waitFor(() => expect(mocks.resetPassword).not.toHaveBeenCalled());
    expect(screen.getAllByText(/At least 8 characters/).length).toBeGreaterThan(0);
  });

  it('reports reset failures and completes a successful password reset', async () => {
    mocks.resetPassword.mockResolvedValueOnce({ error: { message: 'Expired code' } });
    await advanceForgotPasswordToVerify();
    fireEvent.change(screen.getByLabelText('ForgotPassword.otp_label'), {
      target: { value: '123456' },
    });
    fireEvent.change(screen.getByLabelText('ForgotPassword.new_password_label'), {
      target: { value: 'StrongPass1!' },
    });
    fireEvent.change(screen.getByLabelText('ForgotPassword.confirm_password_label'), {
      target: { value: 'StrongPass1!' },
    });
    fireEvent.submit(getFormByButtonName('ForgotPassword.reset_button'));
    expect(await screen.findByText('Expired code')).toBeInTheDocument();

    mocks.resetPassword.mockResolvedValueOnce({ data: {}, error: null });
    fireEvent.submit(getFormByButtonName('ForgotPassword.reset_button'));
    expect(await screen.findByText('ForgotPassword.success_title')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ForgotPassword.sign_in_link' })).toHaveAttribute(
      'href',
      '/sign-in',
    );
  });

  it('handles resend failures and clears the loading state', async () => {
    await advanceForgotPasswordToVerify();
    mocks.sendVerificationOtp.mockResolvedValueOnce({ error: {} });
    fireEvent.click(screen.getByRole('button', { name: 'ForgotPassword.resend_code' }));
    expect(await screen.findByText('Failed to resend code')).toBeInTheDocument();

    mocks.sendVerificationOtp.mockRejectedValueOnce(new Error('network'));
    fireEvent.click(screen.getByRole('button', { name: 'ForgotPassword.resend_code' }));
    expect(await screen.findByText('An unexpected error occurred')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ForgotPassword.resend_code' })).toBeEnabled();
  });
});

describe('VerifyEmailForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendVerificationOtp.mockResolvedValue({ data: {}, error: null });
    mocks.verifyEmail.mockResolvedValue({ data: {}, error: null });
  });

  afterEach(() => cleanup());

  it('sends a code on mount, sanitizes OTP input, and redirects after verification', async () => {
    render(<VerifyEmailForm email="ada@example.com" callbackUrl="/arena" />);
    await waitFor(() =>
      expect(mocks.sendVerificationOtp).toHaveBeenCalledWith({
        email: 'ada@example.com',
        type: 'email-verification',
      }),
    );
    const input = screen.getByLabelText('VerifyEmail.otp_label');
    fireEvent.change(input, { target: { value: 'a1234567' } });
    expect(input).toHaveValue('123456');
    fireEvent.submit(getFormByButtonName('VerifyEmail.verify_button'));
    await waitFor(() => expect(mocks.routerPush).toHaveBeenCalledWith('/arena'));
    expect(mocks.routerRefresh).toHaveBeenCalled();
  });

  it('reports verification provider errors and thrown failures', async () => {
    mocks.verifyEmail.mockResolvedValueOnce({ error: {} });
    const { unmount } = render(<VerifyEmailForm email="ada@example.com" callbackUrl="/arena" />);
    fireEvent.change(screen.getByLabelText('VerifyEmail.otp_label'), {
      target: { value: '123456' },
    });
    fireEvent.submit(getFormByButtonName('VerifyEmail.verify_button'));
    expect(await screen.findByText('Invalid verification code')).toBeInTheDocument();
    unmount();

    mocks.verifyEmail.mockRejectedValueOnce(new Error('network'));
    render(<VerifyEmailForm email="ada@example.com" callbackUrl="/arena" />);
    fireEvent.change(screen.getByLabelText('VerifyEmail.otp_label'), {
      target: { value: '123456' },
    });
    fireEvent.submit(getFormByButtonName('VerifyEmail.verify_button'));
    expect(await screen.findByText('An unexpected error occurred')).toBeInTheDocument();
  });

  it('reports resend errors and confirms a successful resend', async () => {
    mocks.sendVerificationOtp
      .mockResolvedValueOnce({ data: {}, error: null })
      .mockResolvedValueOnce({ error: { message: 'Try later' } })
      .mockResolvedValueOnce({ data: {}, error: null });
    render(<VerifyEmailForm email="ada@example.com" callbackUrl="/arena" />);
    await waitFor(() => expect(mocks.sendVerificationOtp).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'VerifyEmail.resend_code' }));
    expect(await screen.findByText('Try later')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'VerifyEmail.resend_code' }));
    expect(await screen.findByText('VerifyEmail.code_sent')).toBeInTheDocument();
  });
});

describe('CompleteProfileForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.env.NEXT_PUBLIC_EMAIL_ENABLED = 'true';
    mocks.sendProfileOTP.mockResolvedValue({ success: true });
    mocks.updateProfileEmail.mockResolvedValue({ success: true });
    mocks.verifyProfileOTP.mockResolvedValue({ success: true });
  });

  afterEach(() => cleanup());

  it('greets the user and reports OTP delivery errors', async () => {
    mocks.sendProfileOTP.mockResolvedValueOnce({ success: false, error: 'Email unavailable' });
    render(<CompleteProfileForm userName="Ada" />);
    expect(screen.getByText('Ada')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('CompleteProfile.email_label'), {
      target: { value: 'ada@example.com' },
    });
    fireEvent.submit(getFormByButtonName('CompleteProfile.submit_button'));
    expect(await screen.findByText('Email unavailable')).toBeInTheDocument();
  });

  it('handles verification and resend failures after entering the OTP step', async () => {
    await advanceCompleteProfileToVerify();
    const otpInput = screen.getByLabelText('CompleteProfile.otp_label');
    fireEvent.change(otpInput, { target: { value: 'a1234567' } });
    expect(otpInput).toHaveValue('123456');

    mocks.verifyProfileOTP.mockResolvedValueOnce({ success: false });
    fireEvent.submit(getFormByButtonName('CompleteProfile.verify_button'));
    expect(await screen.findByText('Invalid verification code')).toBeInTheDocument();

    mocks.sendProfileOTP.mockRejectedValueOnce(new Error('network'));
    fireEvent.click(screen.getByRole('button', { name: 'CompleteProfile.resend_code' }));
    expect(await screen.findByText('An unexpected error occurred')).toBeInTheDocument();
  });

  it('uses direct profile update when email verification is disabled', async () => {
    mocks.env.NEXT_PUBLIC_EMAIL_ENABLED = 'false';
    mocks.updateProfileEmail.mockResolvedValueOnce({ success: false });
    render(<CompleteProfileForm userName="" />);
    fireEvent.change(screen.getByLabelText('CompleteProfile.email_label'), {
      target: { value: 'ada@example.com' },
    });
    fireEvent.submit(getFormByButtonName('CompleteProfile.submit_button'));
    expect(await screen.findByText('Failed to update email')).toBeInTheDocument();
    expect(mocks.updateProfileEmail).toHaveBeenCalledWith('ada@example.com');
  });
});
