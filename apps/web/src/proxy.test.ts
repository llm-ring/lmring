import { UserStatus } from '@lmring/auth';
import type { NextFetchEvent, NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockProtect = vi.fn();
const mockWithRule = vi.fn(() => ({ protect: mockProtect }));
const mockGetSession = vi.fn();
const mockLoggerWarn = vi.fn();

vi.mock('@lmring/env', () => ({
  env: {
    ARCJET_KEY: '',
    DATABASE_URL: 'postgresql://localhost:5432/test',
    ENCRYPTION_KEY: 'test-encryption-key-32-characters!',
    BETTER_AUTH_SECRET: 'test-secret',
  },
}));

vi.mock('@/libs/Arcjet', () => ({
  default: {
    withRule: mockWithRule,
  },
}));

vi.mock('@/libs/Auth', () => ({
  auth: {
    api: {
      getSession: mockGetSession,
    },
  },
}));

vi.mock('@/libs/Logger', () => ({
  logger: {
    warn: mockLoggerWarn,
  },
}));

vi.mock('@arcjet/next', () => ({
  detectBot: vi.fn(() => ({})),
}));

function createMockRequest(
  pathname: string,
  options: {
    headers?: Record<string, string>;
    searchParams?: Record<string, string>;
  } = {},
): NextRequest {
  const url = new URL(pathname, 'http://localhost:3000');
  if (options.searchParams) {
    for (const [key, value] of Object.entries(options.searchParams)) {
      url.searchParams.set(key, value);
    }
  }

  const headers = new Headers(options.headers || {});

  const createClonableUrl = (sourceUrl: URL): Record<string, unknown> => {
    let currentPathname = sourceUrl.pathname;
    const searchParams = new URLSearchParams(sourceUrl.searchParams);

    const mockUrl: Record<string, unknown> = {
      searchParams,
      toString: () => `${sourceUrl.origin}${currentPathname}?${searchParams.toString()}`,
      clone: () =>
        createClonableUrl(
          new URL(`${sourceUrl.origin}${currentPathname}?${searchParams.toString()}`),
        ),
    };

    Object.defineProperty(mockUrl, 'pathname', {
      get() {
        return currentPathname;
      },
      set(val: string) {
        currentPathname = val;
      },
      enumerable: true,
      configurable: true,
    });

    return mockUrl;
  };

  const nextUrl = createClonableUrl(url);

  return {
    nextUrl,
    url: url.toString(),
    headers,
  } as unknown as NextRequest;
}

function createMockEvent(): NextFetchEvent {
  return {} as NextFetchEvent;
}

describe('proxy', () => {
  const originalProcessEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    mockProtect.mockReset();
    mockGetSession.mockReset();
    mockLoggerWarn.mockReset();
    process.env = { ...originalProcessEnv };
  });

  afterEach(() => {
    process.env = originalProcessEnv;
  });

  describe('Arcjet Bot Protection', () => {
    it('should return 403 when a bot is denied from a hosting IP', async () => {
      process.env.ARCJET_KEY = 'test-key';
      mockProtect.mockResolvedValue({
        isDenied: () => true,
        reason: { isBot: () => true },
        ip: { isHosting: () => true },
      });
      mockGetSession.mockResolvedValue(null);

      const { default: proxy } = await import('./proxy');
      const request = createMockRequest('/');
      const response = await proxy(request, createMockEvent());

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body).toEqual({ error: 'Forbidden' });
    });

    it('should NOT block a denied bot from a non-hosting (residential) IP', async () => {
      process.env.ARCJET_KEY = 'test-key';
      mockProtect.mockResolvedValue({
        isDenied: () => true,
        reason: { isBot: () => true },
        ip: { isHosting: () => false },
      });
      mockGetSession.mockResolvedValue(null);

      const { default: proxy } = await import('./proxy');
      const request = createMockRequest('/');
      const response = await proxy(request, createMockEvent());

      expect(response.status).not.toBe(403);
    });

    it('should continue when request is allowed by Arcjet', async () => {
      process.env.ARCJET_KEY = 'test-key';
      mockProtect.mockResolvedValue({
        isDenied: () => false,
        reason: { isBot: () => false },
        ip: { isHosting: () => false },
      });
      mockGetSession.mockResolvedValue(null);

      const { default: proxy } = await import('./proxy');
      const request = createMockRequest('/');
      const response = await proxy(request, createMockEvent());

      expect(response.status).not.toBe(403);
    });

    it('should skip Arcjet when ARCJET_KEY is not set', async () => {
      delete process.env.ARCJET_KEY;
      mockGetSession.mockResolvedValue(null);

      const { default: proxy } = await import('./proxy');
      const request = createMockRequest('/');
      await proxy(request, createMockEvent());

      expect(mockProtect).not.toHaveBeenCalled();
    });
  });

  describe('Locale Resolution', () => {
    beforeEach(() => {
      delete process.env.ARCJET_KEY;
    });

    it('should redirect legacy /en/path to /?lang=en', async () => {
      mockGetSession.mockResolvedValue(null);

      const { default: proxy } = await import('./proxy');
      const request = createMockRequest('/en/arena');
      const response = await proxy(request, createMockEvent());

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toContain('/arena');
      expect(location).toContain('lang=en');
    });

    it('should redirect legacy /fr/path to /?lang=fr', async () => {
      mockGetSession.mockResolvedValue(null);

      const { default: proxy } = await import('./proxy');
      const request = createMockRequest('/fr/settings');
      const response = await proxy(request, createMockEvent());

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toContain('/settings');
      expect(location).toContain('lang=fr');
    });

    it('should redirect legacy /zh/path to /?lang=zh', async () => {
      mockGetSession.mockResolvedValue(null);

      const { default: proxy } = await import('./proxy');
      const request = createMockRequest('/zh/leaderboard');
      const response = await proxy(request, createMockEvent());

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toContain('/leaderboard');
      expect(location).toContain('lang=zh');
    });

    it('should not redirect paths that look like locale but are not supported', async () => {
      mockGetSession.mockResolvedValue(null);

      const { default: proxy } = await import('./proxy');
      const request = createMockRequest('/de/about');
      const response = await proxy(request, createMockEvent());

      expect(response.status).toBe(200);
    });
  });

  describe('User Status Checks', () => {
    beforeEach(() => {
      delete process.env.ARCJET_KEY;
    });

    it('should redirect disabled user to /account-disabled', async () => {
      mockGetSession.mockResolvedValue({
        user: {
          id: 'user-1',
          status: UserStatus.DISABLED,
        },
      });

      const { default: proxy } = await import('./proxy');
      const request = createMockRequest('/arena');
      const response = await proxy(request, createMockEvent());

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/account-disabled');
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        'Disabled user attempted to access resource',
        expect.objectContaining({ userId: 'user-1' }),
      );
    });

    it('should redirect pending user to /account-disabled', async () => {
      mockGetSession.mockResolvedValue({
        user: {
          id: 'user-2',
          status: UserStatus.PENDING,
        },
      });

      const { default: proxy } = await import('./proxy');
      const request = createMockRequest('/settings');
      const response = await proxy(request, createMockEvent());

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/account-disabled');
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        'Pending user attempted to access resource',
        expect.objectContaining({ userId: 'user-2' }),
      );
    });

    it('should allow disabled user to stay on /account-disabled', async () => {
      mockGetSession.mockResolvedValue({
        user: {
          id: 'user-1',
          status: UserStatus.DISABLED,
        },
      });

      const { default: proxy } = await import('./proxy');
      const request = createMockRequest('/account-disabled');
      const response = await proxy(request, createMockEvent());

      expect(response.status).not.toBe(307);
    });

    it('should redirect active user from /account-disabled to /', async () => {
      mockGetSession.mockResolvedValue({
        user: {
          id: 'user-3',
          status: UserStatus.ACTIVE,
        },
      });

      const { default: proxy } = await import('./proxy');
      const request = createMockRequest('/account-disabled');
      const response = await proxy(request, createMockEvent());

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://localhost:3000/');
    });
  });

  describe('Protected Routes', () => {
    beforeEach(() => {
      delete process.env.ARCJET_KEY;
    });

    const protectedPaths = ['/arena', '/account', '/settings', '/history'];

    it.each(protectedPaths)(
      'should redirect unauthenticated user from %s to /sign-in',
      async (path) => {
        mockGetSession.mockResolvedValue(null);

        const { default: proxy } = await import('./proxy');
        const request = createMockRequest(path);
        const response = await proxy(request, createMockEvent());

        expect(response.status).toBe(307);
        const location = response.headers.get('location');
        expect(location).toContain('/sign-in');
        expect(location).toContain(`callbackUrl=${encodeURIComponent(path)}`);
      },
    );

    it.each(protectedPaths)('should allow authenticated user to access %s', async (path) => {
      mockGetSession.mockResolvedValue({
        user: {
          id: 'user-1',
          status: UserStatus.ACTIVE,
        },
      });

      const { default: proxy } = await import('./proxy');
      const request = createMockRequest(path);
      const response = await proxy(request, createMockEvent());

      expect(response.status).not.toBe(307);
    });

    it('should allow unauthenticated user to access /leaderboard (public route)', async () => {
      mockGetSession.mockResolvedValue(null);

      const { default: proxy } = await import('./proxy');
      const request = createMockRequest('/leaderboard');
      const response = await proxy(request, createMockEvent());

      expect(response.status).not.toBe(307);
      expect(response.status).toBe(200);
    });

    it('should redirect to /sign-in with nested protected path', async () => {
      mockGetSession.mockResolvedValue(null);

      const { default: proxy } = await import('./proxy');
      const request = createMockRequest('/settings/profile');
      const response = await proxy(request, createMockEvent());

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toContain('/sign-in');
    });
  });

  describe('Placeholder Email Redirect', () => {
    beforeEach(() => {
      delete process.env.ARCJET_KEY;
    });

    it('should redirect active user with placeholder email from /arena to /complete-profile', async () => {
      mockGetSession.mockResolvedValue({
        user: {
          id: 'user-linuxdo',
          email: 'linuxdo_123@placeholder.local',
          status: UserStatus.ACTIVE,
        },
      });

      const { default: proxy } = await import('./proxy');
      const request = createMockRequest('/arena');
      const response = await proxy(request, createMockEvent());

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/complete-profile');
    });

    it('should redirect active user with placeholder email from / to /complete-profile', async () => {
      mockGetSession.mockResolvedValue({
        user: {
          id: 'user-linuxdo',
          email: 'linuxdo_456@placeholder.local',
          status: UserStatus.ACTIVE,
        },
      });

      const { default: proxy } = await import('./proxy');
      const request = createMockRequest('/');
      const response = await proxy(request, createMockEvent());

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/complete-profile');
    });

    it('should allow active user with placeholder email to stay on /complete-profile', async () => {
      mockGetSession.mockResolvedValue({
        user: {
          id: 'user-linuxdo',
          email: 'linuxdo_123@placeholder.local',
          status: UserStatus.ACTIVE,
        },
      });

      const { default: proxy } = await import('./proxy');
      const request = createMockRequest('/complete-profile');
      const response = await proxy(request, createMockEvent());

      expect(response.status).not.toBe(307);
    });

    it('should not redirect active user with real email', async () => {
      mockGetSession.mockResolvedValue({
        user: {
          id: 'user-real',
          email: 'real@example.com',
          status: UserStatus.ACTIVE,
        },
      });

      const { default: proxy } = await import('./proxy');
      const request = createMockRequest('/arena');
      const response = await proxy(request, createMockEvent());

      expect(response.status).not.toBe(307);
    });

    it('should not redirect placeholder email user accessing non-protected paths', async () => {
      mockGetSession.mockResolvedValue({
        user: {
          id: 'user-linuxdo',
          email: 'linuxdo_123@placeholder.local',
          status: UserStatus.ACTIVE,
        },
      });

      const { default: proxy } = await import('./proxy');
      const request = createMockRequest('/about');
      const response = await proxy(request, createMockEvent());

      expect(response.status).not.toBe(307);
    });
  });

  describe('Auth Routes', () => {
    beforeEach(() => {
      delete process.env.ARCJET_KEY;
    });

    const authPaths = ['/sign-in', '/sign-up'];

    it.each(authPaths)('should redirect authenticated user from %s to /arena', async (path) => {
      mockGetSession.mockResolvedValue({
        user: {
          id: 'user-1',
          status: UserStatus.ACTIVE,
        },
      });

      const { default: proxy } = await import('./proxy');
      const request = createMockRequest(path);
      const response = await proxy(request, createMockEvent());

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://localhost:3000/arena');
    });

    it.each(authPaths)('should allow unauthenticated user to access %s', async (path) => {
      mockGetSession.mockResolvedValue(null);

      const { default: proxy } = await import('./proxy');
      const request = createMockRequest(path);
      const response = await proxy(request, createMockEvent());

      expect(response.status).not.toBe(307);
    });
  });

  describe('OAuth Callback Interception', () => {
    beforeEach(() => {
      delete process.env.ARCJET_KEY;
    });

    it('should redirect /?code=...&state=... to /api/auth/oauth2/callback/linuxdo', async () => {
      mockGetSession.mockResolvedValue(null);

      const { default: proxy } = await import('./proxy');
      const request = createMockRequest('/', {
        searchParams: { code: 'test-code', state: 'test-state' },
      });
      const response = await proxy(request, createMockEvent());

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toContain('/api/auth/oauth2/callback/linuxdo');
      expect(location).toContain('code=test-code');
      expect(location).toContain('state=test-state');
    });

    it('should not intercept / without code param', async () => {
      mockGetSession.mockResolvedValue(null);

      const { default: proxy } = await import('./proxy');
      const request = createMockRequest('/', {
        searchParams: { state: 'test-state' },
      });
      const response = await proxy(request, createMockEvent());

      expect(response.status).toBe(200);
    });

    it('should not intercept / without state param', async () => {
      mockGetSession.mockResolvedValue(null);

      const { default: proxy } = await import('./proxy');
      const request = createMockRequest('/', {
        searchParams: { code: 'test-code' },
      });
      const response = await proxy(request, createMockEvent());

      expect(response.status).toBe(200);
    });

    it('should not intercept non-root paths with code and state', async () => {
      mockGetSession.mockResolvedValue(null);

      const { default: proxy } = await import('./proxy');
      const request = createMockRequest('/about', {
        searchParams: { code: 'test-code', state: 'test-state' },
      });
      const response = await proxy(request, createMockEvent());

      expect(response.status).toBe(200);
    });
  });

  describe('Response handling', () => {
    beforeEach(() => {
      delete process.env.ARCJET_KEY;
    });

    it('should return NextResponse for normal requests', async () => {
      mockGetSession.mockResolvedValue(null);

      const { default: proxy } = await import('./proxy');
      const request = createMockRequest('/');
      const response = await proxy(request, createMockEvent());

      expect(response).toBeDefined();
      expect(response.status).toBe(200);
    });

    it('should return NextResponse.next for non-protected routes', async () => {
      mockGetSession.mockResolvedValue(null);

      const { default: proxy } = await import('./proxy');
      const request = createMockRequest('/about');
      const response = await proxy(request, createMockEvent());

      expect(response.status).toBe(200);
    });
  });
});
