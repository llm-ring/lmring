import { describe, expect, it } from 'vitest';
import {
  isImageToVideoInput,
  isTextToVideoInput,
  parseParams,
  VideoGenerationParamsSchema,
  validateParams,
} from './validation';

const validTextParams = {
  model: 'openai/sora-2',
  input: {
    type: 'text-to-video' as const,
    prompt: 'A cat playing piano',
  },
};

const validImageParams = {
  model: 'minimax/hailuo-2.3',
  input: {
    type: 'image-to-video' as const,
    prompt: 'Animate this',
    image: {
      url: 'https://example.com/image.png',
      mediaType: 'image/png' as const,
    },
  },
};

describe('validateParams', () => {
  it('accepts valid text-to-video params', () => {
    expect(validateParams(validTextParams)).toEqual({ valid: true });
  });

  it('accepts valid image-to-video params with base64', () => {
    expect(
      validateParams({
        ...validImageParams,
        input: {
          type: 'image-to-video',
          prompt: 'move',
          image: { base64: 'abc123', mediaType: 'image/jpeg' },
        },
      }),
    ).toEqual({ valid: true });
  });

  it('rejects missing model and empty prompt', () => {
    const result = validateParams({
      model: '',
      input: { type: 'text-to-video', prompt: '' },
    });
    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.includes('model'))).toBe(true);
  });

  it('rejects image media without url or base64', () => {
    const result = validateParams({
      model: 'x',
      input: {
        type: 'image-to-video',
        prompt: 'p',
        image: { mediaType: 'image/png' },
      },
    });
    expect(result.valid).toBe(false);
  });

  it('rejects image media with both url and base64', () => {
    const result = validateParams({
      model: 'x',
      input: {
        type: 'image-to-video',
        prompt: 'p',
        image: {
          url: 'https://example.com/a.png',
          base64: 'abc',
          mediaType: 'image/png',
        },
      },
    });
    expect(result.valid).toBe(false);
  });

  it('rejects invalid aspect ratio and duration', () => {
    const result = validateParams({
      ...validTextParams,
      aspectRatio: '2:1',
      duration: 999,
    });
    expect(result.valid).toBe(false);
  });

  it('accepts optional advanced fields', () => {
    expect(
      validateParams({
        ...validTextParams,
        width: 1280,
        height: 720,
        aspectRatio: '16:9',
        duration: 8,
        fps: 24,
        quality: 'high',
        audio: true,
        seed: 42,
        providerOptions: { foo: 'bar' },
      }),
    ).toEqual({ valid: true });
  });
});

describe('parseParams', () => {
  it('returns parsed params for valid input', () => {
    const parsed = parseParams(validTextParams);
    expect(parsed.model).toBe('openai/sora-2');
    expect(parsed.input.type).toBe('text-to-video');
  });

  it('throws for invalid input', () => {
    expect(() => parseParams({ model: '' })).toThrow();
  });
});

describe('type guards', () => {
  it('identifies text and image inputs', () => {
    expect(isTextToVideoInput(validTextParams.input)).toBe(true);
    expect(isImageToVideoInput(validTextParams.input)).toBe(false);
    expect(isImageToVideoInput(validImageParams.input)).toBe(true);
    expect(isTextToVideoInput(validImageParams.input)).toBe(false);
  });
});

describe('VideoGenerationParamsSchema', () => {
  it('parses with safeParse success path', () => {
    const result = VideoGenerationParamsSchema.safeParse(validImageParams);
    expect(result.success).toBe(true);
  });
});
