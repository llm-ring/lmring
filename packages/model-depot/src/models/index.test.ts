import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MODEL_LIST,
  getAllEnabledModels,
  getEnabledModelsForProvider,
  getModel,
  getModelIdsForProvider,
  getModelsForProvider,
  PROVIDER_MODELS_MAP,
} from './index';

describe('PROVIDER_MODELS_MAP', () => {
  it('contains major providers', () => {
    expect(PROVIDER_MODELS_MAP.openai).toBeDefined();
    expect(PROVIDER_MODELS_MAP.anthropic).toBeDefined();
    expect(PROVIDER_MODELS_MAP.google).toBeDefined();
    expect(PROVIDER_MODELS_MAP.groq).toBeDefined();
  });

  it('has models for each provider', () => {
    const providers = Object.keys(PROVIDER_MODELS_MAP);
    expect(providers.length).toBeGreaterThan(40);
  });
});

describe('DEFAULT_MODEL_LIST', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(DEFAULT_MODEL_LIST)).toBe(true);
    expect(DEFAULT_MODEL_LIST.length).toBeGreaterThan(0);
  });

  it('contains models with required fields', () => {
    for (const model of DEFAULT_MODEL_LIST.slice(0, 10)) {
      expect(model.id).toBeDefined();
      expect(model.providerId).toBeDefined();
      expect(model.source).toBe('builtin');
      expect(model.abilities).toBeDefined();
    }
  });

  it('contains models from multiple providers', () => {
    const providerIds = new Set(DEFAULT_MODEL_LIST.map((m) => m.providerId));
    expect(providerIds.size).toBeGreaterThan(10);
  });
});

describe('getModelsForProvider', () => {
  it('returns models for valid provider', () => {
    const models = getModelsForProvider('openai');
    expect(models.length).toBeGreaterThan(0);
    for (const model of models) {
      expect(model.providerId).toBe('openai');
    }
  });

  it('returns empty array for invalid provider', () => {
    const models = getModelsForProvider('invalid');
    expect(models).toEqual([]);
  });

  it('returns models with correct structure', () => {
    const models = getModelsForProvider('anthropic');
    expect(models.length).toBeGreaterThan(0);
    for (const model of models) {
      expect(model.id).toBeDefined();
      expect(model.source).toBe('builtin');
    }
  });
});

describe('getEnabledModelsForProvider', () => {
  it('returns only enabled models', () => {
    const enabledModels = getEnabledModelsForProvider('openai');
    for (const model of enabledModels) {
      expect(model.enabled).toBe(true);
      expect(model.providerId).toBe('openai');
    }
  });

  it('returns subset of all models', () => {
    const allModels = getModelsForProvider('openai');
    const enabledModels = getEnabledModelsForProvider('openai');
    expect(enabledModels.length).toBeLessThanOrEqual(allModels.length);
  });

  it('returns empty array for invalid provider', () => {
    expect(getEnabledModelsForProvider('invalid')).toEqual([]);
  });
});

describe('getModel', () => {
  it('returns specific model', () => {
    const models = getModelsForProvider('openai');
    expect(models.length).toBeGreaterThan(0);
    const firstModel = models[0];
    expect(firstModel).toBeDefined();
    const found = getModel('openai', firstModel?.id ?? '');
    expect(found).toBeDefined();
    expect(found?.id).toBe(firstModel?.id);
    expect(found?.providerId).toBe('openai');
  });

  it('returns undefined for invalid model', () => {
    expect(getModel('openai', 'nonexistent-model')).toBeUndefined();
  });

  it('returns undefined for invalid provider', () => {
    expect(getModel('invalid', 'gpt-4')).toBeUndefined();
  });
});

describe('getAllEnabledModels', () => {
  it('returns all enabled models across providers', () => {
    const enabled = getAllEnabledModels();
    expect(enabled.length).toBeGreaterThan(0);
    for (const model of enabled) {
      expect(model.enabled).toBe(true);
    }
  });

  it('contains models from multiple providers', () => {
    const enabled = getAllEnabledModels();
    const providers = new Set(enabled.map((m) => m.providerId));
    expect(providers.size).toBeGreaterThan(5);
  });
});

describe('upstream model catalog synchronization', () => {
  it.each([
    ['openai', 'gpt-5.6-sol'],
    ['openai', 'gpt-5.6-terra'],
    ['openai', 'gpt-5.6-luna'],
    ['anthropic', 'claude-sonnet-5'],
    ['xai', 'grok-4.5'],
    ['google', 'gemini-3.1-flash-lite-image'],
    ['moonshot', 'kimi-k2.7-code'],
    ['volcengine', 'doubao-seed-2.1-pro'],
  ])('includes %s model %s', (providerId, modelId) => {
    const model = getModel(providerId, modelId);

    expect(model).toMatchObject({
      enabled: true,
      id: modelId,
      providerId,
      source: 'builtin',
    });
  });
});

describe('getModelIdsForProvider', () => {
  it('returns array of model IDs', () => {
    const ids = getModelIdsForProvider('openai');
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(typeof id).toBe('string');
    }
  });

  it('matches models from getModelsForProvider', () => {
    const models = getModelsForProvider('anthropic');
    const ids = getModelIdsForProvider('anthropic');
    expect(ids.length).toBe(models.length);
    for (const model of models) {
      expect(ids).toContain(model.id);
    }
  });

  it('returns empty array for invalid provider', () => {
    expect(getModelIdsForProvider('invalid')).toEqual([]);
  });
});
