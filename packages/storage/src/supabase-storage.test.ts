import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockStorageBucket: {
    createSignedUploadUrl: vi.fn(),
    createSignedUrl: vi.fn(),
    upload: vi.fn(),
    remove: vi.fn(),
    download: vi.fn(),
    list: vi.fn(),
  },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.mockCreateClient.mockImplementation(() => ({
    storage: {
      from: vi.fn().mockReturnValue(mocks.mockStorageBucket),
    },
  })),
}));

import { createSupabaseStorage, SupabaseStorage } from './supabase-storage';

describe('SupabaseStorage', () => {
  let storage: SupabaseStorage;
  const config = {
    url: 'https://test.supabase.co',
    serviceRoleKey: 'test-service-role-key',
    bucket: 'test-bucket',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new SupabaseStorage(config);
  });

  describe('constructor', () => {
    it('creates Supabase client with correct config', () => {
      expect(mocks.mockCreateClient).toHaveBeenCalledWith(config.url, config.serviceRoleKey);
    });
  });

  describe('createUploadUrl', () => {
    it('returns signed upload URL with token', async () => {
      mocks.mockStorageBucket.createSignedUploadUrl.mockResolvedValue({
        data: {
          signedUrl: 'https://upload-url.com',
          path: 'test/file.txt',
          token: 'upload-token',
        },
        error: null,
      });

      const result = await storage.createUploadUrl('test/file.txt');

      expect(mocks.mockStorageBucket.createSignedUploadUrl).toHaveBeenCalledWith('test/file.txt');
      expect(result).toEqual({
        url: 'https://upload-url.com',
        path: 'test/file.txt',
        fields: { token: 'upload-token' },
      });
    });

    it('throws error when API fails', async () => {
      mocks.mockStorageBucket.createSignedUploadUrl.mockResolvedValue({
        data: null,
        error: { message: 'Bucket not found' },
      });

      await expect(storage.createUploadUrl('test/file.txt')).rejects.toThrow(
        'Failed to create upload URL: Bucket not found',
      );
    });

    it('throws error when data is null', async () => {
      mocks.mockStorageBucket.createSignedUploadUrl.mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(storage.createUploadUrl('test/file.txt')).rejects.toThrow(
        'Failed to create upload URL: undefined',
      );
    });
  });

  describe('createDownloadUrl', () => {
    it('returns signed download URL', async () => {
      mocks.mockStorageBucket.createSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://download-url.com' },
        error: null,
      });

      const result = await storage.createDownloadUrl('test/file.txt');

      expect(mocks.mockStorageBucket.createSignedUrl).toHaveBeenCalledWith('test/file.txt', 3600);
      expect(result).toBe('https://download-url.com');
    });

    it('uses custom expiration option', async () => {
      mocks.mockStorageBucket.createSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://download-url.com' },
        error: null,
      });

      await storage.createDownloadUrl('test/file.txt', { expiresIn: 600 });

      expect(mocks.mockStorageBucket.createSignedUrl).toHaveBeenCalledWith('test/file.txt', 600);
    });

    it('uses env expiration when option not provided', async () => {
      vi.stubEnv('SUPABASE_SIGNED_URL_EXPIRATION', '1800');
      mocks.mockStorageBucket.createSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://download-url.com' },
        error: null,
      });

      await storage.createDownloadUrl('test/file.txt');

      expect(mocks.mockStorageBucket.createSignedUrl).toHaveBeenCalledWith('test/file.txt', 1800);
      vi.unstubAllEnvs();
    });

    it('throws error when API fails', async () => {
      mocks.mockStorageBucket.createSignedUrl.mockResolvedValue({
        data: null,
        error: { message: 'File not found' },
      });

      await expect(storage.createDownloadUrl('test/file.txt')).rejects.toThrow(
        'Failed to create download URL: File not found',
      );
    });
  });

  describe('upload', () => {
    it('uploads file with upsert mode', async () => {
      mocks.mockStorageBucket.upload.mockResolvedValue({ error: null });
      const buffer = Buffer.from('test content');

      await storage.upload('test/file.txt', buffer, { contentType: 'text/plain' });

      expect(mocks.mockStorageBucket.upload).toHaveBeenCalledWith('test/file.txt', buffer, {
        contentType: 'text/plain',
        upsert: true,
      });
    });

    it('uploads Blob data', async () => {
      mocks.mockStorageBucket.upload.mockResolvedValue({ error: null });
      const blob = new Blob(['test content'], { type: 'text/plain' });

      await storage.upload('test/file.txt', blob);

      expect(mocks.mockStorageBucket.upload).toHaveBeenCalledWith('test/file.txt', blob, {
        contentType: undefined,
        upsert: true,
      });
    });

    it('throws error when upload fails', async () => {
      mocks.mockStorageBucket.upload.mockResolvedValue({
        error: { message: 'Storage limit exceeded' },
      });

      await expect(storage.upload('test/file.txt', Buffer.from('test'))).rejects.toThrow(
        'Failed to upload file: Storage limit exceeded',
      );
    });
  });

  describe('delete', () => {
    it('removes file from storage', async () => {
      mocks.mockStorageBucket.remove.mockResolvedValue({ error: null });

      await storage.delete('test/file.txt');

      expect(mocks.mockStorageBucket.remove).toHaveBeenCalledWith(['test/file.txt']);
    });

    it('throws error when delete fails', async () => {
      mocks.mockStorageBucket.remove.mockResolvedValue({
        error: { message: 'Permission denied' },
      });

      await expect(storage.delete('test/file.txt')).rejects.toThrow(
        'Failed to delete file: Permission denied',
      );
    });
  });

  describe('getAsBase64', () => {
    it('returns base64 data URI', async () => {
      const blob = new Blob(['test content'], { type: 'text/plain' });
      mocks.mockStorageBucket.download.mockResolvedValue({
        data: blob,
        error: null,
      });

      const result = await storage.getAsBase64('test/file.txt', 'text/plain');

      expect(result).toBe('data:text/plain;base64,dGVzdCBjb250ZW50');
    });

    it('throws error when download fails', async () => {
      mocks.mockStorageBucket.download.mockResolvedValue({
        data: null,
        error: { message: 'File not found' },
      });

      await expect(storage.getAsBase64('test/file.txt', 'text/plain')).rejects.toThrow(
        'Failed to download file: File not found',
      );
    });
  });

  describe('exists', () => {
    it('returns true when file exists', async () => {
      mocks.mockStorageBucket.list.mockResolvedValue({
        data: [{ name: 'file.txt' }],
        error: null,
      });

      const result = await storage.exists('folder/file.txt');

      expect(mocks.mockStorageBucket.list).toHaveBeenCalledWith('folder', {
        search: 'file.txt',
      });
      expect(result).toBe(true);
    });

    it('returns false when file does not exist', async () => {
      mocks.mockStorageBucket.list.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await storage.exists('folder/nonexistent.txt');

      expect(result).toBe(false);
    });

    it('returns false when API errors', async () => {
      mocks.mockStorageBucket.list.mockResolvedValue({
        data: null,
        error: { message: 'Error' },
      });

      const result = await storage.exists('folder/file.txt');

      expect(result).toBe(false);
    });

    it('handles root-level files', async () => {
      mocks.mockStorageBucket.list.mockResolvedValue({
        data: [{ name: 'file.txt' }],
        error: null,
      });

      await storage.exists('file.txt');

      expect(mocks.mockStorageBucket.list).toHaveBeenCalledWith('', {
        search: 'file.txt',
      });
    });
  });
});

describe('createSupabaseStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates SupabaseStorage with env config', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
    vi.stubEnv('SUPABASE_STORAGE_BUCKET', 'custom-bucket');

    const storage = createSupabaseStorage();

    expect(storage).toBeInstanceOf(SupabaseStorage);
    expect(mocks.mockCreateClient).toHaveBeenCalledWith(
      'https://project.supabase.co',
      'service-key',
    );
  });

  it('uses default bucket when not set', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');

    const storage = createSupabaseStorage();

    expect(storage).toBeInstanceOf(SupabaseStorage);
  });

  it('throws error when URL missing', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'key');

    expect(() => createSupabaseStorage()).toThrow(
      'Missing Supabase configuration: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required',
    );
  });

  it('throws error when service role key missing', () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');

    expect(() => createSupabaseStorage()).toThrow(
      'Missing Supabase configuration: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required',
    );
  });
});
