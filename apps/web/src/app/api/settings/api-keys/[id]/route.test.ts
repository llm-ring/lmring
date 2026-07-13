import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GET as GET_CUSTOM,
  POST as POST_CUSTOM,
} from '@/app/api/settings/api-keys/[id]/custom-models/route';
import { GET } from '@/app/api/settings/api-keys/[id]/enabled-models/route';
import { DELETE, PUT } from '@/app/api/settings/api-keys/[id]/model-overrides/[modelId]/route';
import {
  GET as GET_OVERRIDES,
  POST as POST_OVERRIDES,
} from '@/app/api/settings/api-keys/[id]/model-overrides/route';
import {
  DELETE as DELETE_KEY,
  GET as GET_KEY,
  PATCH as PATCH_KEY,
} from '@/app/api/settings/api-keys/[id]/route';
import { createMockRequest, parseJsonResponse, setupTestEnvironment } from '@/test/helpers';

const { mockDbInstance, mockAuthInstance, mockDecryptFn, mockGetDefaultProviderUrl, mockLogError } =
  vi.hoisted(() => {
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
      mockDbInstance: {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        onConflictDoUpdate: vi.fn().mockReturnThis(),
      },
      mockAuthInstance: {
        api: {
          getSession: vi.fn().mockResolvedValue(mockSession),
        },
      },
      mockDecryptFn: vi.fn((encrypted: string) => encrypted.replace('encrypted_', '')),
      mockGetDefaultProviderUrl: vi.fn((provider: string) => `https://default/${provider}`),
      mockLogError: vi.fn(),
    };
  });

vi.mock('@/libs/Auth', () => ({
  auth: mockAuthInstance,
}));

vi.mock('@lmring/database', () => ({
  db: mockDbInstance,
  eq: vi.fn(),
  and: vi.fn(),
  decrypt: mockDecryptFn,
}));

vi.mock('@lmring/database/schema', () => ({
  apiKeys: {
    id: 'id',
    userId: 'userId',
    providerName: 'providerName',
    encryptedKey: 'encryptedKey',
    configSource: 'configSource',
    proxyUrl: 'proxyUrl',
    enabled: 'enabled',
    isCustom: 'isCustom',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
  userEnabledModels: {
    apiKeyId: 'apiKeyId',
    modelId: 'modelId',
    enabled: 'enabled',
  },
  userCustomModels: {
    id: 'id',
    apiKeyId: 'apiKeyId',
    modelId: 'modelId',
    displayName: 'displayName',
    createdAt: 'createdAt',
  },
  userModelOverrides: {
    id: 'id',
    apiKeyId: 'apiKeyId',
    modelId: 'modelId',
    displayName: 'displayName',
    groupName: 'groupName',
    abilities: 'abilities',
    supportsStreaming: 'supportsStreaming',
    priceCurrency: 'priceCurrency',
    inputPrice: 'inputPrice',
    outputPrice: 'outputPrice',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
}));

vi.mock('@lmring/model-depot', () => ({
  getModelIdsForProvider: vi.fn().mockReturnValue(['gpt-4o', 'gpt-3.5-turbo']),
}));

vi.mock('@lmring/ai-hub', () => ({
  getDefaultProviderUrl: mockGetDefaultProviderUrl,
}));

vi.mock('@/libs/error-logging', () => ({
  logError: mockLogError,
}));

setupTestEnvironment();

const validUuid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const invalidUuid = 'invalid-uuid';

const mockApiKey = {
  id: validUuid,
  userId: 'test-user-id',
  providerName: 'openai',
  encryptedKey: 'encrypted_key',
  configSource: 'manual',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('API Keys Sub-Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/settings/api-keys/[id]/enabled-models', () => {
    it('should return 401 when user is not authenticated', async () => {
      vi.mocked(mockAuthInstance.api.getSession).mockResolvedValueOnce(null);

      const request = createMockRequest(
        'GET',
        `http://localhost:3000/api/settings/api-keys/${validUuid}/enabled-models`,
      );
      const response = await GET(request, { params: Promise.resolve({ id: validUuid }) });
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(401);
      expect(data.error).toBe('UNAUTHORIZED');
    });

    it('should return 400 for invalid UUID format', async () => {
      const request = createMockRequest(
        'GET',
        `http://localhost:3000/api/settings/api-keys/${invalidUuid}/enabled-models`,
      );
      const response = await GET(request, { params: Promise.resolve({ id: invalidUuid }) });
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(400);
      expect(data.error).toBe('INVALID_ID');
    });

    it('should return 404 when API key not found', async () => {
      mockDbInstance.select.mockReturnValue(mockDbInstance);
      mockDbInstance.from.mockReturnValue(mockDbInstance);
      mockDbInstance.where.mockReturnValue(mockDbInstance);
      mockDbInstance.limit.mockResolvedValue([]);

      const request = createMockRequest(
        'GET',
        `http://localhost:3000/api/settings/api-keys/${validUuid}/enabled-models`,
      );
      const response = await GET(request, { params: Promise.resolve({ id: validUuid }) });
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(404);
      expect(data.error).toBe('API_KEY_NOT_FOUND');
    });

    it('should return enabled models list', async () => {
      mockDbInstance.select.mockReturnValue(mockDbInstance);
      mockDbInstance.from.mockReturnValue(mockDbInstance);
      mockDbInstance.where.mockReturnValueOnce(mockDbInstance).mockResolvedValueOnce([
        { modelId: 'gpt-4o', enabled: true },
        { modelId: 'gpt-3.5-turbo', enabled: false },
      ]);
      mockDbInstance.limit.mockResolvedValue([mockApiKey]);

      const request = createMockRequest(
        'GET',
        `http://localhost:3000/api/settings/api-keys/${validUuid}/enabled-models`,
      );
      const response = await GET(request, { params: Promise.resolve({ id: validUuid }) });
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(200);
      expect(data.models).toBeDefined();
      expect(Array.isArray(data.models)).toBe(true);
    });
  });

  describe('GET /api/settings/api-keys/[id]/custom-models', () => {
    it('should return 401 when user is not authenticated', async () => {
      vi.mocked(mockAuthInstance.api.getSession).mockResolvedValueOnce(null);

      const request = createMockRequest(
        'GET',
        `http://localhost:3000/api/settings/api-keys/${validUuid}/custom-models`,
      );
      const response = await GET_CUSTOM(request, { params: Promise.resolve({ id: validUuid }) });
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(401);
      expect(data.error).toBe('UNAUTHORIZED');
    });

    it('should return 400 for invalid UUID format', async () => {
      const request = createMockRequest(
        'GET',
        `http://localhost:3000/api/settings/api-keys/${invalidUuid}/custom-models`,
      );
      const response = await GET_CUSTOM(request, { params: Promise.resolve({ id: invalidUuid }) });
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(400);
      expect(data.error).toBe('INVALID_ID');
    });

    it('should return custom models list', async () => {
      mockDbInstance.select.mockReturnValue(mockDbInstance);
      mockDbInstance.from.mockReturnValue(mockDbInstance);
      mockDbInstance.where
        .mockReturnValueOnce(mockDbInstance)
        .mockResolvedValueOnce([
          { id: 'custom-1', modelId: 'my-model', displayName: 'My Model', createdAt: new Date() },
        ]);
      mockDbInstance.limit.mockResolvedValue([mockApiKey]);

      const request = createMockRequest(
        'GET',
        `http://localhost:3000/api/settings/api-keys/${validUuid}/custom-models`,
      );
      const response = await GET_CUSTOM(request, { params: Promise.resolve({ id: validUuid }) });
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(200);
      expect(data.models).toBeDefined();
    });
  });

  describe('POST /api/settings/api-keys/[id]/custom-models', () => {
    it('should return 400 when validation fails', async () => {
      mockDbInstance.select.mockReturnValue(mockDbInstance);
      mockDbInstance.from.mockReturnValue(mockDbInstance);
      mockDbInstance.where.mockReturnValue(mockDbInstance);
      mockDbInstance.limit.mockResolvedValue([mockApiKey]);

      const request = createMockRequest(
        'POST',
        `http://localhost:3000/api/settings/api-keys/${validUuid}/custom-models`,
        { modelId: '' },
      );
      const response = await POST_CUSTOM(request, { params: Promise.resolve({ id: validUuid }) });
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation failed');
    });

    it('should return 409 when model already exists', async () => {
      mockDbInstance.select.mockReturnValue(mockDbInstance);
      mockDbInstance.from.mockReturnValue(mockDbInstance);
      mockDbInstance.where.mockReturnValue(mockDbInstance);
      mockDbInstance.limit
        .mockResolvedValueOnce([mockApiKey])
        .mockResolvedValueOnce([{ id: 'existing', modelId: 'my-model' }]);

      const request = createMockRequest(
        'POST',
        `http://localhost:3000/api/settings/api-keys/${validUuid}/custom-models`,
        { modelId: 'my-model', displayName: 'My Model' },
      );
      const response = await POST_CUSTOM(request, { params: Promise.resolve({ id: validUuid }) });
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(409);
      expect(data.error).toBe('MODEL_EXISTS');
    });

    it('should create custom model successfully', async () => {
      mockDbInstance.select.mockReturnValue(mockDbInstance);
      mockDbInstance.from.mockReturnValue(mockDbInstance);
      mockDbInstance.where.mockReturnValue(mockDbInstance);
      mockDbInstance.limit.mockResolvedValueOnce([mockApiKey]).mockResolvedValueOnce([]);

      mockDbInstance.insert.mockReturnValue(mockDbInstance);
      mockDbInstance.values.mockReturnValue(mockDbInstance);
      mockDbInstance.returning.mockResolvedValueOnce([
        { id: 'new-model', modelId: 'my-model', displayName: 'My Model' },
      ]);
      mockDbInstance.onConflictDoUpdate.mockReturnValue(mockDbInstance);

      const request = createMockRequest(
        'POST',
        `http://localhost:3000/api/settings/api-keys/${validUuid}/custom-models`,
        { modelId: 'my-model', displayName: 'My Model' },
      );
      const response = await POST_CUSTOM(request, { params: Promise.resolve({ id: validUuid }) });
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(201);
      expect(data.modelId).toBe('my-model');
    });
  });

  describe('GET /api/settings/api-keys/[id]/model-overrides', () => {
    it('should return model overrides list', async () => {
      mockDbInstance.select.mockReturnValue(mockDbInstance);
      mockDbInstance.from.mockReturnValue(mockDbInstance);
      mockDbInstance.where
        .mockReturnValueOnce(mockDbInstance)
        .mockResolvedValueOnce([
          { id: 'override-1', modelId: 'gpt-4o', displayName: 'GPT-4 Turbo', groupName: 'Premium' },
        ]);
      mockDbInstance.limit.mockResolvedValue([mockApiKey]);

      const request = createMockRequest(
        'GET',
        `http://localhost:3000/api/settings/api-keys/${validUuid}/model-overrides`,
      );
      const response = await GET_OVERRIDES(request, { params: Promise.resolve({ id: validUuid }) });
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(200);
      expect(data.overrides).toBeDefined();
    });
  });

  describe('POST /api/settings/api-keys/[id]/model-overrides', () => {
    it('should create model override successfully', async () => {
      mockDbInstance.select.mockReturnValue(mockDbInstance);
      mockDbInstance.from.mockReturnValue(mockDbInstance);
      mockDbInstance.where.mockReturnValue(mockDbInstance);
      mockDbInstance.limit.mockResolvedValue([mockApiKey]);

      mockDbInstance.insert.mockReturnValue(mockDbInstance);
      mockDbInstance.values.mockReturnValue(mockDbInstance);
      mockDbInstance.onConflictDoUpdate.mockReturnValue(mockDbInstance);
      mockDbInstance.returning.mockResolvedValue([
        { id: 'override-1', modelId: 'gpt-4o', displayName: 'Custom GPT-4' },
      ]);

      const request = createMockRequest(
        'POST',
        `http://localhost:3000/api/settings/api-keys/${validUuid}/model-overrides`,
        { modelId: 'gpt-4o', displayName: 'Custom GPT-4' },
      );
      const response = await POST_OVERRIDES(request, {
        params: Promise.resolve({ id: validUuid }),
      });
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(201);
      expect(data.modelId).toBe('gpt-4o');
    });
  });

  describe('PUT /api/settings/api-keys/[id]/model-overrides/[modelId]', () => {
    it('should return 400 for invalid model ID', async () => {
      mockDbInstance.select.mockReturnValue(mockDbInstance);
      mockDbInstance.from.mockReturnValue(mockDbInstance);
      mockDbInstance.where.mockReturnValue(mockDbInstance);
      mockDbInstance.limit.mockResolvedValue([mockApiKey]);

      const longModelId = 'a'.repeat(250);
      const request = createMockRequest(
        'PUT',
        `http://localhost:3000/api/settings/api-keys/${validUuid}/model-overrides/${longModelId}`,
        { displayName: 'Updated' },
      );
      const response = await PUT(request, {
        params: Promise.resolve({ id: validUuid, modelId: longModelId }),
      });
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(400);
      expect(data.error).toBe('INVALID_MODEL_ID');
    });

    it('should update model override successfully', async () => {
      mockDbInstance.select.mockReturnValue(mockDbInstance);
      mockDbInstance.from.mockReturnValue(mockDbInstance);
      mockDbInstance.where.mockReturnValue(mockDbInstance);
      mockDbInstance.limit.mockResolvedValue([mockApiKey]);

      mockDbInstance.insert.mockReturnValue(mockDbInstance);
      mockDbInstance.values.mockReturnValue(mockDbInstance);
      mockDbInstance.onConflictDoUpdate.mockReturnValue(mockDbInstance);
      mockDbInstance.returning.mockResolvedValue([
        { id: 'override-1', modelId: 'gpt-4o', displayName: 'Updated GPT-4' },
      ]);

      const request = createMockRequest(
        'PUT',
        `http://localhost:3000/api/settings/api-keys/${validUuid}/model-overrides/gpt-4o`,
        { displayName: 'Updated GPT-4' },
      );
      const response = await PUT(request, {
        params: Promise.resolve({ id: validUuid, modelId: 'gpt-4o' }),
      });
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(200);
      expect(data.displayName).toBe('Updated GPT-4');
    });
  });

  describe('DELETE /api/settings/api-keys/[id]/model-overrides/[modelId]', () => {
    it('should return 404 when override not found', async () => {
      mockDbInstance.select.mockReturnValue(mockDbInstance);
      mockDbInstance.from.mockReturnValue(mockDbInstance);
      mockDbInstance.where.mockReturnValue(mockDbInstance);
      mockDbInstance.limit.mockResolvedValue([mockApiKey]);

      mockDbInstance.delete.mockReturnValue(mockDbInstance);
      mockDbInstance.where.mockReturnValue(mockDbInstance);
      mockDbInstance.returning.mockResolvedValue([]);

      const request = createMockRequest(
        'DELETE',
        `http://localhost:3000/api/settings/api-keys/${validUuid}/model-overrides/gpt-4o`,
      );
      const response = await DELETE(request, {
        params: Promise.resolve({ id: validUuid, modelId: 'gpt-4o' }),
      });
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(404);
      expect(data.error).toBe('OVERRIDE_NOT_FOUND');
    });

    it('should delete model override successfully', async () => {
      mockDbInstance.select.mockReturnValue(mockDbInstance);
      mockDbInstance.from.mockReturnValue(mockDbInstance);
      mockDbInstance.where.mockReturnValue(mockDbInstance);
      mockDbInstance.limit.mockResolvedValue([mockApiKey]);

      mockDbInstance.delete.mockReturnValue(mockDbInstance);
      mockDbInstance.where.mockReturnValue(mockDbInstance);
      mockDbInstance.returning.mockResolvedValue([{ id: 'override-1' }]);

      const request = createMockRequest(
        'DELETE',
        `http://localhost:3000/api/settings/api-keys/${validUuid}/model-overrides/gpt-4o`,
      );
      const response = await DELETE(request, {
        params: Promise.resolve({ id: validUuid, modelId: 'gpt-4o' }),
      });
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(200);
      expect(data.message).toContain('deleted successfully');
    });
  });
});

describe('API Key by ID route (GET/PATCH/DELETE)', () => {
  const fullKey = {
    id: validUuid,
    userId: 'test-user-id',
    providerName: 'openai',
    encryptedKey: 'encrypted_sk-secret',
    proxyUrl: null as string | null,
    enabled: true,
    configSource: 'manual',
    isCustom: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDefaultProviderUrl.mockReturnValue('https://default/openai');
    mockDecryptFn.mockImplementation((encrypted: string) => encrypted.replace('encrypted_', ''));
  });

  describe('GET /api/settings/api-keys/[id]', () => {
    it('returns 401 when unauthenticated', async () => {
      vi.mocked(mockAuthInstance.api.getSession).mockResolvedValueOnce(null);
      const request = createMockRequest(
        'GET',
        `http://localhost:3000/api/settings/api-keys/${validUuid}`,
      );
      const response = await GET_KEY(request, { params: Promise.resolve({ id: validUuid }) });
      expect(response.status).toBe(401);
    });

    it('returns 400 for invalid id', async () => {
      const response = await GET_KEY(
        createMockRequest('GET', 'http://localhost:3000/api/settings/api-keys/bad'),
        { params: Promise.resolve({ id: invalidUuid }) },
      );
      const data = await parseJsonResponse(response);
      expect(response.status).toBe(400);
      expect(data.error).toBe('INVALID_ID');
    });

    it('returns 404 when key not found', async () => {
      mockDbInstance.select.mockReturnValue(mockDbInstance);
      mockDbInstance.from.mockReturnValue(mockDbInstance);
      mockDbInstance.where.mockReturnValue(mockDbInstance);
      mockDbInstance.limit.mockResolvedValue([]);

      const response = await GET_KEY(
        createMockRequest('GET', `http://localhost:3000/api/settings/api-keys/${validUuid}`),
        { params: Promise.resolve({ id: validUuid }) },
      );
      expect(response.status).toBe(404);
    });

    it('returns decrypted key and default proxy when proxyUrl is null', async () => {
      mockDbInstance.select.mockReturnValue(mockDbInstance);
      mockDbInstance.from.mockReturnValue(mockDbInstance);
      mockDbInstance.where.mockReturnValue(mockDbInstance);
      mockDbInstance.limit.mockResolvedValue([fullKey]);

      const response = await GET_KEY(
        createMockRequest('GET', `http://localhost:3000/api/settings/api-keys/${validUuid}`),
        { params: Promise.resolve({ id: validUuid }) },
      );
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(200);
      expect(data.apiKey).toBe('sk-secret');
      expect(data.proxyUrl).toBe('https://default/openai');
      expect(mockGetDefaultProviderUrl).toHaveBeenCalledWith('openai');
    });

    it('returns null apiKey when encryptedKey is missing and uses stored proxyUrl', async () => {
      mockDbInstance.select.mockReturnValue(mockDbInstance);
      mockDbInstance.from.mockReturnValue(mockDbInstance);
      mockDbInstance.where.mockReturnValue(mockDbInstance);
      mockDbInstance.limit.mockResolvedValue([
        { ...fullKey, encryptedKey: null, proxyUrl: 'https://custom.proxy' },
      ]);

      const response = await GET_KEY(
        createMockRequest('GET', `http://localhost:3000/api/settings/api-keys/${validUuid}`),
        { params: Promise.resolve({ id: validUuid }) },
      );
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(200);
      expect(data.apiKey).toBeNull();
      expect(data.proxyUrl).toBe('https://custom.proxy');
      expect(mockDecryptFn).not.toHaveBeenCalled();
    });

    it('returns 500 on unexpected errors', async () => {
      mockDbInstance.select.mockImplementation(() => {
        throw new Error('db boom');
      });

      const response = await GET_KEY(
        createMockRequest('GET', `http://localhost:3000/api/settings/api-keys/${validUuid}`),
        { params: Promise.resolve({ id: validUuid }) },
      );
      expect(response.status).toBe(500);
      expect(mockLogError).toHaveBeenCalled();
    });
  });

  describe('PATCH /api/settings/api-keys/[id]', () => {
    it('returns 401 when unauthenticated', async () => {
      vi.mocked(mockAuthInstance.api.getSession).mockResolvedValueOnce(null);
      const request = createMockRequest(
        'PATCH',
        `http://localhost:3000/api/settings/api-keys/${validUuid}`,
        { enabled: true },
      );
      const response = await PATCH_KEY(request, { params: Promise.resolve({ id: validUuid }) });
      expect(response.status).toBe(401);
    });

    it('returns 400 for invalid id', async () => {
      const request = createMockRequest(
        'PATCH',
        'http://localhost:3000/api/settings/api-keys/bad',
        { enabled: true },
      );
      const response = await PATCH_KEY(request, { params: Promise.resolve({ id: invalidUuid }) });
      expect(response.status).toBe(400);
    });

    it('returns 400 for invalid body', async () => {
      const request = createMockRequest(
        'PATCH',
        `http://localhost:3000/api/settings/api-keys/${validUuid}`,
        { enabled: 'yes' },
      );
      const response = await PATCH_KEY(request, { params: Promise.resolve({ id: validUuid }) });
      const data = await parseJsonResponse(response);
      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation failed');
    });

    it('returns 404 when key not found', async () => {
      mockDbInstance.select.mockReturnValue(mockDbInstance);
      mockDbInstance.from.mockReturnValue(mockDbInstance);
      mockDbInstance.where.mockReturnValue(mockDbInstance);
      mockDbInstance.limit.mockResolvedValue([]);

      const request = createMockRequest(
        'PATCH',
        `http://localhost:3000/api/settings/api-keys/${validUuid}`,
        { enabled: false },
      );
      const response = await PATCH_KEY(request, { params: Promise.resolve({ id: validUuid }) });
      expect(response.status).toBe(404);
    });

    it('updates enabled flag and returns proxy from default when null', async () => {
      mockDbInstance.select.mockReturnValue(mockDbInstance);
      mockDbInstance.from.mockReturnValue(mockDbInstance);
      mockDbInstance.where.mockReturnValue(mockDbInstance);
      mockDbInstance.limit.mockResolvedValue([fullKey]);
      mockDbInstance.update.mockReturnValue(mockDbInstance);
      mockDbInstance.set.mockReturnValue(mockDbInstance);
      mockDbInstance.returning.mockResolvedValue([{ ...fullKey, enabled: false, proxyUrl: null }]);

      const request = createMockRequest(
        'PATCH',
        `http://localhost:3000/api/settings/api-keys/${validUuid}`,
        { enabled: false },
      );
      const response = await PATCH_KEY(request, { params: Promise.resolve({ id: validUuid }) });
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(200);
      expect(data.message).toBe('API key updated successfully');
      expect(data.enabled).toBe(false);
      expect(data.proxyUrl).toBe('https://default/openai');
    });

    it('allows empty body (no enabled field) and uses stored proxyUrl', async () => {
      mockDbInstance.select.mockReturnValue(mockDbInstance);
      mockDbInstance.from.mockReturnValue(mockDbInstance);
      mockDbInstance.where.mockReturnValue(mockDbInstance);
      mockDbInstance.limit.mockResolvedValue([fullKey]);
      mockDbInstance.update.mockReturnValue(mockDbInstance);
      mockDbInstance.set.mockReturnValue(mockDbInstance);
      mockDbInstance.returning.mockResolvedValue([{ ...fullKey, proxyUrl: 'https://my.proxy' }]);

      const request = createMockRequest(
        'PATCH',
        `http://localhost:3000/api/settings/api-keys/${validUuid}`,
        {},
      );
      const response = await PATCH_KEY(request, { params: Promise.resolve({ id: validUuid }) });
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(200);
      expect(data.proxyUrl).toBe('https://my.proxy');
    });

    it('returns 500 on unexpected errors', async () => {
      mockDbInstance.select.mockImplementation(() => {
        throw new Error('patch fail');
      });
      const request = createMockRequest(
        'PATCH',
        `http://localhost:3000/api/settings/api-keys/${validUuid}`,
        { enabled: true },
      );
      const response = await PATCH_KEY(request, { params: Promise.resolve({ id: validUuid }) });
      expect(response.status).toBe(500);
      expect(mockLogError).toHaveBeenCalled();
    });
  });

  describe('DELETE /api/settings/api-keys/[id]', () => {
    it('returns 401 when unauthenticated', async () => {
      vi.mocked(mockAuthInstance.api.getSession).mockResolvedValueOnce(null);
      const response = await DELETE_KEY(
        createMockRequest('DELETE', `http://localhost:3000/api/settings/api-keys/${validUuid}`),
        { params: Promise.resolve({ id: validUuid }) },
      );
      expect(response.status).toBe(401);
    });

    it('returns 400 for invalid id', async () => {
      const response = await DELETE_KEY(
        createMockRequest('DELETE', 'http://localhost:3000/api/settings/api-keys/bad'),
        { params: Promise.resolve({ id: invalidUuid }) },
      );
      expect(response.status).toBe(400);
    });

    it('returns 404 when key not found', async () => {
      mockDbInstance.select.mockReturnValue(mockDbInstance);
      mockDbInstance.from.mockReturnValue(mockDbInstance);
      mockDbInstance.where.mockReturnValue(mockDbInstance);
      mockDbInstance.limit.mockResolvedValue([]);

      const response = await DELETE_KEY(
        createMockRequest('DELETE', `http://localhost:3000/api/settings/api-keys/${validUuid}`),
        { params: Promise.resolve({ id: validUuid }) },
      );
      expect(response.status).toBe(404);
    });

    it('returns 403 when deleting built-in providers', async () => {
      mockDbInstance.select.mockReturnValue(mockDbInstance);
      mockDbInstance.from.mockReturnValue(mockDbInstance);
      mockDbInstance.where.mockReturnValue(mockDbInstance);
      mockDbInstance.limit.mockResolvedValue([{ ...fullKey, isCustom: false }]);

      const response = await DELETE_KEY(
        createMockRequest('DELETE', `http://localhost:3000/api/settings/api-keys/${validUuid}`),
        { params: Promise.resolve({ id: validUuid }) },
      );
      const data = await parseJsonResponse(response);
      expect(response.status).toBe(403);
      expect(data.error).toBe('Cannot delete built-in providers');
    });

    it('deletes custom providers', async () => {
      mockDbInstance.select.mockReturnValue(mockDbInstance);
      mockDbInstance.from.mockReturnValue(mockDbInstance);
      mockDbInstance.where.mockReturnValue(mockDbInstance);
      mockDbInstance.limit.mockResolvedValue([{ ...fullKey, isCustom: true }]);
      mockDbInstance.delete.mockReturnValue(mockDbInstance);

      const response = await DELETE_KEY(
        createMockRequest('DELETE', `http://localhost:3000/api/settings/api-keys/${validUuid}`),
        { params: Promise.resolve({ id: validUuid }) },
      );
      const data = await parseJsonResponse(response);
      expect(response.status).toBe(200);
      expect(data.message).toBe('Provider deleted successfully');
    });

    it('returns 500 on unexpected errors', async () => {
      mockDbInstance.select.mockImplementation(() => {
        throw new Error('delete fail');
      });
      const response = await DELETE_KEY(
        createMockRequest('DELETE', `http://localhost:3000/api/settings/api-keys/${validUuid}`),
        { params: Promise.resolve({ id: validUuid }) },
      );
      expect(response.status).toBe(500);
      expect(mockLogError).toHaveBeenCalled();
    });
  });
});
