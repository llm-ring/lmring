import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock external dependencies
vi.mock('better-auth/minimal', () => ({
  betterAuth: vi.fn(() => ({
    api: {},
    handler: vi.fn(),
  })),
}));

vi.mock('@better-auth/core/utils/id', () => ({
  generateId: vi.fn((size?: number) => (size ? `mock-id-${size}` : 'mock-id')),
}));

vi.mock('better-auth/api', () => ({
  createAuthMiddleware: vi.fn((handler) => handler),
}));

vi.mock('@better-auth/drizzle-adapter', () => ({
  drizzleAdapter: vi.fn(() => ({})),
}));

const { mockSyncUserProviderIdFromAccount, mockSendOTP } = vi.hoisted(() => ({
  mockSyncUserProviderIdFromAccount: vi.fn(),
  mockSendOTP: vi.fn(),
}));

vi.mock('@lmring/database', () => ({
  db: {},
  users: {},
  session: {},
  account: {},
  verification: {},
  syncUserProviderIdFromAccount: mockSyncUserProviderIdFromAccount,
}));

vi.mock('better-auth/plugins/email-otp', () => ({
  emailOTP: vi.fn((opts) => ({ id: 'email-otp', options: opts })),
}));

vi.mock('better-auth/plugins/generic-oauth', () => ({
  genericOAuth: vi.fn((opts) => ({ id: 'generic-oauth', options: opts })),
}));

vi.mock('./email', () => ({
  createEmailService: vi.fn(() => ({
    sendOTP: mockSendOTP,
  })),
}));

import { createAuth } from './server';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { generateId } from '@better-auth/core/utils/id';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { genericOAuth } from 'better-auth/plugins/generic-oauth';
import { createEmailService } from './email';
import { AuthErrorCodes } from './errors';

function getBetterAuthConfig(): any {
  return (betterAuth as any).mock.calls.at(-1)[0];
}

describe('server', () => {
  const validSecret = 'a'.repeat(32);
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  const baseOptions = {
    deploymentMode: 'selfhost' as const,
    baseURL: 'http://localhost:3000',
    secret: validSecret,
    logger: mockLogger,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSyncUserProviderIdFromAccount.mockResolvedValue(true);
    mockSendOTP.mockResolvedValue({ success: true });
  });

  describe('createAuth', () => {
    it('initializes Better-Auth with valid config', () => {
      const auth = createAuth(baseOptions);

      expect(betterAuth).toHaveBeenCalled();
      expect(auth).toBeDefined();
    });

    it('creates database adapter with drizzle', () => {
      createAuth(baseOptions);

      expect(drizzleAdapter).toHaveBeenCalled();
    });

    it('logs initialization messages', () => {
      createAuth({
        ...baseOptions,
        deploymentMode: 'saas',
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Initializing Better-Auth server instance',
        expect.any(Object),
      );
    });

    it('throws on invalid secret', () => {
      expect(() =>
        createAuth({
          ...baseOptions,
          secret: 'short',
        }),
      ).toThrow();
    });

    it('logs error when initialization fails', () => {
      expect(() =>
        createAuth({
          ...baseOptions,
          secret: '',
        }),
      ).toThrow();

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('configures email/password authentication', () => {
      createAuth(baseOptions);

      const betterAuthCall = getBetterAuthConfig();
      expect(betterAuthCall.emailAndPassword).toEqual({
        enabled: true,
        minPasswordLength: 8,
        maxPasswordLength: 128,
        autoSignIn: true,
      });
    });

    it('configures session settings', () => {
      createAuth(baseOptions);

      const betterAuthCall = getBetterAuthConfig();
      expect(betterAuthCall.session).toEqual({
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        updateAge: 60 * 60 * 24, // 1 day
        freshAge: 60 * 10, // 10 minutes
      });
    });

    it('configures account linking', () => {
      createAuth(baseOptions);

      const betterAuthCall = getBetterAuthConfig();
      expect(betterAuthCall.account.accountLinking).toEqual({
        enabled: true,
        trustedProviders: ['github', 'google', 'linuxdo'],
      });
    });

    it('configures user field mapping', () => {
      createAuth(baseOptions);

      const betterAuthCall = getBetterAuthConfig();
      expect(betterAuthCall.user.fields).toEqual({
        name: 'fullName',
        image: 'avatarUrl',
        emailVerified: 'emailVerified',
      });
    });

    it('configures hooks for authentication flow', () => {
      createAuth(baseOptions);

      const betterAuthCall = getBetterAuthConfig();
      expect(betterAuthCall.hooks).toBeDefined();
      expect(betterAuthCall.hooks.before).toBeDefined();
      expect(betterAuthCall.hooks.after).toBeDefined();
    });

    it('configures database hooks for account sync', () => {
      createAuth(baseOptions);

      const betterAuthCall = getBetterAuthConfig();
      expect(betterAuthCall.databaseHooks).toBeDefined();
      expect(betterAuthCall.databaseHooks.account.create.after).toBeDefined();
      expect(betterAuthCall.databaseHooks.account.update.after).toBeDefined();
    });

    it('logs success message on creation', () => {
      createAuth(baseOptions);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Better-Auth server instance created successfully',
        expect.any(Object),
      );
    });

    it('passes OAuth credentials in saas mode', () => {
      createAuth({
        ...baseOptions,
        deploymentMode: 'saas',
        githubClientId: 'github-id',
        githubClientSecret: 'github-secret',
        googleClientId: 'google-id',
        googleClientSecret: 'google-secret',
      });

      const betterAuthCall = getBetterAuthConfig();
      expect(betterAuthCall.socialProviders.github).toBeDefined();
      expect(betterAuthCall.socialProviders.google).toBeDefined();
    });

    it('uses default logger when none is provided', () => {
      const auth = createAuth({
        deploymentMode: 'selfhost',
        baseURL: 'http://localhost:3000',
        secret: validSecret,
      });

      expect(auth).toBeDefined();
      expect(betterAuth).toHaveBeenCalled();
    });
  });

  describe('generateId callback', () => {
    it('returns undefined for user model so DB generates UUID', () => {
      createAuth(baseOptions);
      const config = getBetterAuthConfig();
      const generateIdFn = config.advanced.database.generateId;

      expect(generateIdFn({ model: 'user' })).toBeUndefined();
      expect(generateId).not.toHaveBeenCalled();
    });

    it('uses Better-Auth generateId for non-user models without size', () => {
      createAuth(baseOptions);
      const config = getBetterAuthConfig();
      const generateIdFn = config.advanced.database.generateId;

      expect(generateIdFn({ model: 'session' })).toBe('mock-id');
      expect(generateId).toHaveBeenCalledWith();
    });

    it('uses Better-Auth generateId with size for non-user models', () => {
      createAuth(baseOptions);
      const config = getBetterAuthConfig();
      const generateIdFn = config.advanced.database.generateId;

      expect(generateIdFn({ model: 'account', size: 16 })).toBe('mock-id-16');
      expect(generateId).toHaveBeenCalledWith(16);
    });
  });

  describe('email OTP plugin', () => {
    it('configures email OTP plugin when emailEnabled and resendApiKey are set', () => {
      createAuth({
        ...baseOptions,
        emailEnabled: true,
        resendApiKey: 're_test_key',
        emailFrom: 'auth@lmring.com',
      });

      expect(createEmailService).toHaveBeenCalledWith(
        {
          resendApiKey: 're_test_key',
          emailFrom: 'auth@lmring.com',
        },
        mockLogger,
      );
      expect(emailOTP).toHaveBeenCalledWith(
        expect.objectContaining({
          otpLength: 6,
          expiresIn: 600,
          allowedAttempts: 5,
          sendVerificationOTP: expect.any(Function),
        }),
      );

      const config = getBetterAuthConfig();
      expect(config.plugins.some((p: any) => p.id === 'email-otp')).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Email OTP plugin configured');
    });

    it('sendVerificationOTP delegates to email service on success', async () => {
      createAuth({
        ...baseOptions,
        emailEnabled: true,
        resendApiKey: 're_test_key',
      });

      const emailOTPOptions = (emailOTP as any).mock.calls[0][0];
      await emailOTPOptions.sendVerificationOTP({
        email: 'user@example.com',
        otp: '123456',
        type: 'sign-in',
      });

      expect(mockSendOTP).toHaveBeenCalledWith({
        email: 'user@example.com',
        otp: '123456',
        type: 'sign-in',
      });
    });

    it('sendVerificationOTP throws when email service fails with error message', async () => {
      mockSendOTP.mockResolvedValueOnce({ success: false, error: 'Rate limited' });

      createAuth({
        ...baseOptions,
        emailEnabled: true,
        resendApiKey: 're_test_key',
      });

      const emailOTPOptions = (emailOTP as any).mock.calls[0][0];
      await expect(
        emailOTPOptions.sendVerificationOTP({
          email: 'user@example.com',
          otp: '123456',
          type: 'sign-in',
        }),
      ).rejects.toThrow('Rate limited');
    });

    it('sendVerificationOTP throws default message when error is missing', async () => {
      mockSendOTP.mockResolvedValueOnce({ success: false });

      createAuth({
        ...baseOptions,
        emailEnabled: true,
        resendApiKey: 're_test_key',
      });

      const emailOTPOptions = (emailOTP as any).mock.calls[0][0];
      await expect(
        emailOTPOptions.sendVerificationOTP({
          email: 'user@example.com',
          otp: '123456',
          type: 'email-verification',
        }),
      ).rejects.toThrow('Failed to send verification email');
    });

    it('does not add email OTP plugin when email is disabled', () => {
      createAuth(baseOptions);

      expect(emailOTP).not.toHaveBeenCalled();
      const config = getBetterAuthConfig();
      expect(config.plugins.some((p: any) => p.id === 'email-otp')).toBe(false);
    });
  });

  describe('linuxdo OAuth plugin', () => {
    const linuxdoOptions = {
      ...baseOptions,
      linuxdoAuthEnabled: true,
      linuxdoClientId: 'linuxdo-client-id',
      linuxdoClientSecret: 'linuxdo-client-secret',
    };

    it('configures Linux.do OAuth plugin when credentials are provided', () => {
      createAuth(linuxdoOptions);

      expect(genericOAuth).toHaveBeenCalled();
      const config = getBetterAuthConfig();
      expect(config.plugins.some((p: any) => p.id === 'generic-oauth')).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Linux.do OAuth plugin configured');
    });

    it('maps Linux.do profile to user with avatar template', () => {
      createAuth(linuxdoOptions);

      const oauthConfig = (genericOAuth as any).mock.calls[0][0].config[0];
      const mapped = oauthConfig.mapProfileToUser({
        id: 42,
        username: 'alice',
        name: 'Alice',
        avatar_template: '/user_avatar/linux.do/{username}/{size}/xxx.png',
      });

      expect(mapped).toEqual({
        id: '42',
        email: 'linuxdo_42@placeholder.local',
        name: 'Alice',
        image: 'https://linux.do/user_avatar/linux.do/{username}/200/xxx.png',
      });
    });

    it('maps Linux.do profile without avatar and falls back to username for name', () => {
      createAuth(linuxdoOptions);

      const oauthConfig = (genericOAuth as any).mock.calls[0][0].config[0];
      const mapped = oauthConfig.mapProfileToUser({
        id: 7,
        username: 'bob',
      });

      expect(mapped).toEqual({
        id: '7',
        email: 'linuxdo_7@placeholder.local',
        name: 'bob',
        image: undefined,
      });
    });

    it('exchanges token successfully', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            access_token: 'access-token',
            refresh_token: 'refresh-token',
            expires_in: 3600,
            token_type: 'Bearer',
            scope: 'user profile',
          }),
      } as Response);

      createAuth(linuxdoOptions);
      const oauthConfig = (genericOAuth as any).mock.calls[0][0].config[0];

      const token = await oauthConfig.getToken({
        code: 'auth-code',
        redirectURI: 'http://localhost:3000/callback',
        codeVerifier: 'verifier',
      });

      expect(fetchMock).toHaveBeenCalledWith(
        'https://connect.linux.do/oauth2/token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        }),
      );
      expect(token.accessToken).toBe('access-token');
      expect(token.refreshToken).toBe('refresh-token');
      expect(token.tokenType).toBe('Bearer');
      expect(token.scopes).toEqual(['user', 'profile']);
      expect(token.accessTokenExpiresAt).toBeInstanceOf(Date);

      fetchMock.mockRestore();
    });

    it('handles token response without expires_in or scope', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            access_token: 'access-token',
            token_type: 'Bearer',
          }),
      } as Response);

      createAuth(linuxdoOptions);
      const oauthConfig = (genericOAuth as any).mock.calls[0][0].config[0];

      const token = await oauthConfig.getToken({
        code: 'auth-code',
        redirectURI: 'http://localhost:3000/callback',
      });

      expect(token.accessTokenExpiresAt).toBeUndefined();
      expect(token.scopes).toEqual([]);

      fetchMock.mockRestore();
    });

    it('throws on network error during token exchange', async () => {
      const networkError = new Error('fetch failed');
      (networkError as any).cause = Object.assign(new Error('ECONNREFUSED'), {
        code: 'ECONNREFUSED',
      });
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(networkError);

      createAuth(linuxdoOptions);
      const oauthConfig = (genericOAuth as any).mock.calls[0][0].config[0];

      await expect(
        oauthConfig.getToken({
          code: 'auth-code',
          redirectURI: 'http://localhost:3000/callback',
        }),
      ).rejects.toThrow('Token exchange failed: network error (ECONNREFUSED)');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Linux.do token exchange network error',
        expect.objectContaining({
          error: 'fetch failed',
          code: 'ECONNREFUSED',
        }),
      );

      fetchMock.mockRestore();
    });

    it('throws on network error without cause', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce('boom');

      createAuth(linuxdoOptions);
      const oauthConfig = (genericOAuth as any).mock.calls[0][0].config[0];

      await expect(
        oauthConfig.getToken({
          code: 'auth-code',
          redirectURI: 'http://localhost:3000/callback',
        }),
      ).rejects.toThrow('Token exchange failed: network error (fetch failed)');

      fetchMock.mockRestore();
    });

    it('throws when token exchange returns non-JSON', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: async () => '<html>Bad Gateway</html>',
      } as Response);

      createAuth(linuxdoOptions);
      const oauthConfig = (genericOAuth as any).mock.calls[0][0].config[0];

      await expect(
        oauthConfig.getToken({
          code: 'auth-code',
          redirectURI: 'http://localhost:3000/callback',
        }),
      ).rejects.toThrow('Token exchange failed: non-JSON response (status 502)');

      fetchMock.mockRestore();
    });

    it('throws when token exchange returns error JSON', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            error: 'invalid_grant',
            error_description: 'code expired',
          }),
      } as Response);

      createAuth(linuxdoOptions);
      const oauthConfig = (genericOAuth as any).mock.calls[0][0].config[0];

      await expect(
        oauthConfig.getToken({
          code: 'auth-code',
          redirectURI: 'http://localhost:3000/callback',
        }),
      ).rejects.toThrow('Token exchange failed: invalid_grant - code expired');

      fetchMock.mockRestore();
    });

    it('does not add Linux.do plugin when disabled', () => {
      createAuth(baseOptions);

      expect(genericOAuth).not.toHaveBeenCalled();
    });
  });

  describe('before hooks', () => {
    it('throws WEAK_PASSWORD when sign-up password fails validation', async () => {
      createAuth(baseOptions);
      const { before } = getBetterAuthConfig().hooks;

      await expect(
        before({
          path: '/sign-up/email',
          method: 'POST',
          body: { password: 'weak' },
        }),
      ).rejects.toMatchObject({
        code: AuthErrorCodes.WEAK_PASSWORD,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Password validation failed during sign-up',
        expect.objectContaining({
          path: '/sign-up/email',
          errors: expect.any(Array),
        }),
      );
    });

    it('allows strong password on sign-up', async () => {
      createAuth(baseOptions);
      const { before } = getBetterAuthConfig().hooks;

      await expect(
        before({
          path: '/sign-up/email',
          method: 'POST',
          body: { password: 'StrongPass1!' },
        }),
      ).resolves.toBeUndefined();
    });

    it('skips password validation when password is missing', async () => {
      createAuth(baseOptions);
      const { before } = getBetterAuthConfig().hooks;

      await expect(
        before({
          path: '/sign-up/email',
          method: 'POST',
          body: {},
        }),
      ).resolves.toBeUndefined();
    });

    it('logs authentication attempt for sign-in and callback paths', async () => {
      createAuth(baseOptions);
      const { before } = getBetterAuthConfig().hooks;

      await before({
        path: '/sign-in/email',
        method: 'POST',
        body: { email: 'user@example.com' },
      });
      await before({
        path: '/sign-in/social',
        method: 'POST',
        body: { provider: 'github' },
      });
      await before({
        path: '/callback/github',
        method: 'GET',
        body: undefined,
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Authentication attempt started',
        expect.objectContaining({ path: '/sign-in/email' }),
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Authentication attempt started',
        expect.objectContaining({ path: '/sign-in/social' }),
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Authentication attempt started',
        expect.objectContaining({ path: '/callback/github' }),
      );
    });
  });

  describe('after hooks - session status checks', () => {
    function createSessionContext(path: string, user: Record<string, unknown> | null, useNewSession = true) {
      const sessionInfo = user
        ? { user }
        : null;
      return {
        path,
        method: 'POST',
        context: {
          newSession: useNewSession ? sessionInfo : null,
          session: useNewSession ? null : sessionInfo,
        },
      };
    }

    it('throws USER_DISABLED for disabled users', async () => {
      createAuth(baseOptions);
      const { after } = getBetterAuthConfig().hooks;

      await expect(
        after(
          createSessionContext('/sign-in/email', {
            id: 'u1',
            status: 'disabled',
            role: 'user',
          }),
        ),
      ).rejects.toMatchObject({ code: AuthErrorCodes.USER_DISABLED });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Disabled user attempted to sign in',
        expect.objectContaining({
          userId: 'u1',
          errorCode: AuthErrorCodes.USER_DISABLED,
        }),
      );
    });

    it('throws USER_PENDING for pending users', async () => {
      createAuth(baseOptions);
      const { after } = getBetterAuthConfig().hooks;

      await expect(
        after(
          createSessionContext('/sign-in/social', {
            id: 'u2',
            status: 'pending',
            role: 'user',
          }),
        ),
      ).rejects.toMatchObject({ code: AuthErrorCodes.USER_PENDING });
    });

    it('logs success for active email sign-in', async () => {
      createAuth(baseOptions);
      const { after } = getBetterAuthConfig().hooks;

      await after(
        createSessionContext('/sign-in/email', {
          id: 'u3',
          status: 'active',
          role: 'user',
        }),
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'User signed in successfully',
        expect.objectContaining({
          userId: 'u3',
          provider: 'email',
        }),
      );
    });

    it('uses session fallback when newSession is absent', async () => {
      createAuth(baseOptions);
      const { after } = getBetterAuthConfig().hooks;

      await after(
        createSessionContext(
          '/sign-in/email',
          { id: 'u4', status: 'active', role: 'admin' },
          false,
        ),
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'User signed in successfully',
        expect.objectContaining({ userId: 'u4', role: 'admin' }),
      );
    });

    it('syncs provider id on GitHub OAuth callback for active users', async () => {
      createAuth(baseOptions);
      const { after } = getBetterAuthConfig().hooks;

      await after(
        createSessionContext('/callback/github', {
          id: 'u-gh',
          status: 'active',
          role: 'user',
        }),
      );

      expect(mockSyncUserProviderIdFromAccount).toHaveBeenCalledWith('u-gh', 'github');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Synced OAuth provider id to user record',
        expect.objectContaining({
          source: 'middleware:callback',
          userId: 'u-gh',
          providerId: 'github',
        }),
      );
    });

    it('syncs provider id on Google OAuth callback', async () => {
      createAuth(baseOptions);
      const { after } = getBetterAuthConfig().hooks;

      await after(
        createSessionContext('/callback/google', {
          id: 'u-go',
          status: 'active',
          role: 'user',
        }),
      );

      expect(mockSyncUserProviderIdFromAccount).toHaveBeenCalledWith('u-go', 'google');
    });

    it('syncs provider id on Linux.do OAuth callback', async () => {
      createAuth(baseOptions);
      const { after } = getBetterAuthConfig().hooks;

      await after(
        createSessionContext('/callback/linuxdo', {
          id: 'u-ld',
          status: 'active',
          role: 'user',
        }),
      );

      expect(mockSyncUserProviderIdFromAccount).toHaveBeenCalledWith('u-ld', 'linuxdo');
    });

    it('does not sync when callback path has unknown provider', async () => {
      createAuth(baseOptions);
      const { after } = getBetterAuthConfig().hooks;

      await after(
        createSessionContext('/callback/unknown', {
          id: 'u-unk',
          status: 'active',
          role: 'user',
        }),
      );

      expect(mockSyncUserProviderIdFromAccount).not.toHaveBeenCalled();
    });

    it('warns when provider sync finds no account record', async () => {
      mockSyncUserProviderIdFromAccount.mockResolvedValueOnce(false);
      createAuth(baseOptions);
      const { after } = getBetterAuthConfig().hooks;

      await after(
        createSessionContext('/callback/github', {
          id: 'u-none',
          status: 'active',
          role: 'user',
        }),
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No OAuth account record found for user during provider sync',
        expect.objectContaining({
          source: 'middleware:callback',
          userId: 'u-none',
          providerId: 'github',
        }),
      );
    });

    it('logs error when provider sync throws', async () => {
      mockSyncUserProviderIdFromAccount.mockRejectedValueOnce(new Error('db down'));
      createAuth(baseOptions);
      const { after } = getBetterAuthConfig().hooks;

      await after(
        createSessionContext('/callback/github', {
          id: 'u-err',
          status: 'active',
          role: 'user',
        }),
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to sync OAuth provider id to user record',
        expect.objectContaining({
          source: 'middleware:callback',
          userId: 'u-err',
          providerId: 'github',
          error: 'db down',
        }),
      );
    });

    it('logs unknown error message when provider sync throws non-Error', async () => {
      mockSyncUserProviderIdFromAccount.mockRejectedValueOnce('string-error');
      createAuth(baseOptions);
      const { after } = getBetterAuthConfig().hooks;

      await after(
        createSessionContext('/callback/github', {
          id: 'u-str',
          status: 'active',
          role: 'user',
        }),
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to sync OAuth provider id to user record',
        expect.objectContaining({
          error: 'Unknown error',
        }),
      );
    });

    it('logs when authentication completes without user context', async () => {
      createAuth(baseOptions);
      const { after } = getBetterAuthConfig().hooks;

      await after(createSessionContext('/sign-in/email', null));

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Authentication attempt completed without user context',
        expect.objectContaining({ path: '/sign-in/email' }),
      );
    });

    it('ignores non sign-in paths', async () => {
      createAuth(baseOptions);
      const { after } = getBetterAuthConfig().hooks;

      await after({
        path: '/get-session',
        method: 'GET',
        context: {
          newSession: { user: { id: 'u1', status: 'disabled' } },
          session: null,
        },
      });

      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        'Disabled user attempted to sign in',
        expect.anything(),
      );
    });

    it('logs oauth provider for social sign-in paths', async () => {
      createAuth(baseOptions);
      const { after } = getBetterAuthConfig().hooks;

      await after(
        createSessionContext('/sign-in/social', {
          id: 'u-social',
          status: 'active',
          role: 'user',
        }),
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'User signed in successfully',
        expect.objectContaining({
          provider: 'oauth',
        }),
      );
    });
  });

  describe('databaseHooks account create/update', () => {
    it('syncs supported provider on account create', async () => {
      createAuth(baseOptions);
      const { databaseHooks } = getBetterAuthConfig();

      await databaseHooks.account.create.after({
        userId: 'user-1',
        providerId: 'github',
        accountId: 'gh-1',
      });

      expect(mockSyncUserProviderIdFromAccount).toHaveBeenCalledWith('user-1', 'github');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Synced OAuth provider id to user record',
        expect.objectContaining({
          source: 'databaseHook:create',
          providerId: 'github',
        }),
      );
    });

    it('syncs supported provider on account update', async () => {
      createAuth(baseOptions);
      const { databaseHooks } = getBetterAuthConfig();

      await databaseHooks.account.update.after({
        userId: 'user-2',
        providerId: 'google',
        accountId: 'go-1',
      });

      expect(mockSyncUserProviderIdFromAccount).toHaveBeenCalledWith('user-2', 'google');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Synced OAuth provider id to user record',
        expect.objectContaining({
          source: 'databaseHook:update',
          providerId: 'google',
        }),
      );
    });

    it('syncs linuxdo provider from account record', async () => {
      createAuth(baseOptions);
      const { databaseHooks } = getBetterAuthConfig();

      await databaseHooks.account.create.after({
        userId: 'user-3',
        providerId: 'linuxdo',
        accountId: 'ld-1',
      });

      expect(mockSyncUserProviderIdFromAccount).toHaveBeenCalledWith('user-3', 'linuxdo');
    });

    it('skips unsupported provider on account create', async () => {
      createAuth(baseOptions);
      const { databaseHooks } = getBetterAuthConfig();

      await databaseHooks.account.create.after({
        userId: 'user-4',
        providerId: 'credential',
        accountId: 'cred-1',
      });

      expect(mockSyncUserProviderIdFromAccount).not.toHaveBeenCalled();
    });

    it('skips null/undefined account records', async () => {
      createAuth(baseOptions);
      const { databaseHooks } = getBetterAuthConfig();

      await databaseHooks.account.create.after(null);
      await databaseHooks.account.update.after(undefined);

      expect(mockSyncUserProviderIdFromAccount).not.toHaveBeenCalled();
    });
  });
});
