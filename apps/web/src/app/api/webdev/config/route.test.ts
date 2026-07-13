import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockRequest, parseJsonResponse, setupTestEnvironment } from '@/test/helpers';
import { GET } from './route';

const { mockAuthInstance, mockGetWebDevConfig } = vi.hoisted(() => {
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
      email: 'test@example.com',
      emailVerified: true,
      name: 'Test User',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  return {
    mockAuthInstance: {
      api: {
        getSession: vi.fn().mockResolvedValue(mockSession),
      },
    },
    mockGetWebDevConfig: vi.fn().mockReturnValue({ enabled: true }),
  };
});

vi.mock('@/libs/Auth', () => ({
  auth: mockAuthInstance,
}));

vi.mock('@/libs/webdev-config', () => ({
  getWebDevConfig: mockGetWebDevConfig,
}));

vi.mock('@/libs/error-logging', () => ({
  logError: vi.fn(),
}));

setupTestEnvironment();

describe('WebDev Config API', () => {
  beforeEach(() => {
    mockGetWebDevConfig.mockReturnValue({ enabled: true });
  });

  describe('GET /api/webdev/config', () => {
    it('returns 401 when unauthenticated', async () => {
      mockAuthInstance.api.getSession.mockResolvedValueOnce(null);

      const request = createMockRequest('GET', 'http://localhost:3000/api/webdev/config');
      const response = await GET(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns webdev config when authenticated', async () => {
      mockGetWebDevConfig.mockReturnValue({ enabled: true, reason: undefined });

      const request = createMockRequest('GET', 'http://localhost:3000/api/webdev/config');
      const response = await GET(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(200);
      expect(data.enabled).toBe(true);
      expect(mockGetWebDevConfig).toHaveBeenCalled();
    });

    it('returns 500 when getWebDevConfig throws', async () => {
      mockGetWebDevConfig.mockImplementationOnce(() => {
        throw new Error('config boom');
      });

      const request = createMockRequest('GET', 'http://localhost:3000/api/webdev/config');
      const response = await GET(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });
});
