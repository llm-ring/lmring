'use client';

import { deserialize, type PersistedThemeConfig, serialize } from '@lmring/theme';
import type { PersistStorage, StorageValue } from 'zustand/middleware';

export const THEME_STORAGE_KEY = 'lmring-theme-config';

export type ThemePersistedState = PersistedThemeConfig;

export interface ThemeConfigSnapshot {
  config: PersistedThemeConfig;
  updatedAt: string | null;
}

interface ThemeStorageEnvelope {
  state: string;
  version: number;
  updatedAt?: string;
}

interface ThemeStoragePayload {
  config: PersistedThemeConfig;
  version: number;
  updatedAt: string | null;
}

interface ThemeApiResponse {
  themeConfig?: unknown;
  updatedAt?: unknown;
}

function isIsoDateString(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function parseConfig(value: unknown): PersistedThemeConfig | null {
  try {
    return deserialize(JSON.stringify(value));
  } catch {
    return null;
  }
}

function parseRawEnvelope(raw: string): ThemeStorageEnvelope | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }

    const state = (parsed as { state?: unknown }).state;
    const version = (parsed as { version?: unknown }).version;
    const updatedAt = (parsed as { updatedAt?: unknown }).updatedAt;

    if (typeof state !== 'string' || typeof version !== 'number') {
      return null;
    }

    return {
      state,
      version,
      updatedAt: isIsoDateString(updatedAt) ? updatedAt : undefined,
    };
  } catch {
    return null;
  }
}

function parseStoragePayload(raw: string): ThemeStoragePayload | null {
  const envelope = parseRawEnvelope(raw);
  if (envelope) {
    const config = deserialize(envelope.state);
    if (!config) {
      return null;
    }

    return {
      config,
      version: envelope.version,
      updatedAt: envelope.updatedAt ?? null,
    };
  }

  const legacyConfig = deserialize(raw);
  if (!legacyConfig) {
    return null;
  }

  return {
    config: legacyConfig,
    version: 0,
    updatedAt: null,
  };
}

function writeSnapshot(storageKey: string, snapshot: ThemeConfigSnapshot, version: number): void {
  if (typeof window === 'undefined') {
    return;
  }

  const payload: ThemeStorageEnvelope = {
    state: serialize(snapshot.config),
    version,
    updatedAt: snapshot.updatedAt ?? new Date().toISOString(),
  };

  window.localStorage.setItem(storageKey, JSON.stringify(payload));
}

function readSnapshot(storageKey: string): ThemeStoragePayload | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return null;
  }

  return parseStoragePayload(raw);
}

function resolveSnapshotFromApiResponse(data: ThemeApiResponse): ThemeConfigSnapshot | null {
  const config = parseConfig(data.themeConfig);
  if (!config) {
    return null;
  }

  return {
    config,
    updatedAt: isIsoDateString(data.updatedAt) ? data.updatedAt : null,
  };
}

function toTimestamp(value: string | null): number {
  if (!value) {
    return 0;
  }

  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

export function isServerSnapshotNewer(
  localSnapshot: ThemeConfigSnapshot | null,
  serverSnapshot: ThemeConfigSnapshot,
): boolean {
  if (!localSnapshot) {
    return true;
  }

  return toTimestamp(serverSnapshot.updatedAt) > toTimestamp(localSnapshot.updatedAt);
}

export const themePersistStorage: PersistStorage<ThemePersistedState> = {
  getItem(name): StorageValue<ThemePersistedState> | null {
    try {
      const payload = readSnapshot(name);
      if (!payload) {
        return null;
      }

      return {
        state: payload.config,
        version: payload.version,
      };
    } catch (error) {
      console.error('Failed to read theme config from localStorage:', error);
      return null;
    }
  },

  setItem(name, value): void {
    try {
      writeSnapshot(
        name,
        {
          config: value.state,
          updatedAt: new Date().toISOString(),
        },
        value.version ?? 0,
      );
    } catch (error) {
      console.error('Failed to save theme config to localStorage:', error);
    }
  },

  removeItem(name): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.removeItem(name);
    } catch (error) {
      console.error('Failed to clear theme config from localStorage:', error);
    }
  },
};

export function saveToLocal(config: PersistedThemeConfig, updatedAt?: string | null): void {
  writeSnapshot(
    THEME_STORAGE_KEY,
    {
      config,
      updatedAt: updatedAt ?? new Date().toISOString(),
    },
    0,
  );
}

export function loadFromLocal(): PersistedThemeConfig | null {
  const value = themePersistStorage.getItem(THEME_STORAGE_KEY);
  if (value instanceof Promise || !value || !('state' in value)) {
    return null;
  }

  return value.state ?? null;
}

export function loadLocalThemeSnapshot(): ThemeConfigSnapshot | null {
  const payload = readSnapshot(THEME_STORAGE_KEY);
  if (!payload) {
    return null;
  }

  return {
    config: payload.config,
    updatedAt: payload.updatedAt,
  };
}

export function clearFromLocal(): void {
  themePersistStorage.removeItem(THEME_STORAGE_KEY);
}

export async function fetchThemeConfigFromServer(): Promise<ThemeConfigSnapshot | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const response = await fetch('/api/user/theme', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as ThemeApiResponse;
    return resolveSnapshotFromApiResponse(data);
  } catch (error) {
    console.error('Failed to fetch theme config from server:', error);
    return null;
  }
}

export async function saveThemeConfigToServer(
  config: PersistedThemeConfig,
): Promise<ThemeConfigSnapshot | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const response = await fetch('/api/user/theme', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as ThemeApiResponse;
    const snapshot = resolveSnapshotFromApiResponse(data) ?? {
      config,
      updatedAt: null,
    };

    saveToLocal(snapshot.config, snapshot.updatedAt);
    return snapshot;
  } catch (error) {
    console.error('Failed to save theme config to server:', error);
    return null;
  }
}
