import { describe, expect, it } from 'vitest';
import { DEFAULT_MODEL_LIST } from '../models';
import { getRuntimeModelId, getRuntimeProvider, isVideoModel } from './model-type';

describe('model-type utils', () => {
  it('isVideoModel returns true only for video type models', () => {
    const video = DEFAULT_MODEL_LIST.find((m) => m.type === 'video');
    const nonVideo = DEFAULT_MODEL_LIST.find((m) => m.type !== 'video');

    expect(video).toBeDefined();
    expect(nonVideo).toBeDefined();
    expect(isVideoModel(video!.id)).toBe(true);
    expect(isVideoModel(nonVideo!.id)).toBe(false);
    expect(isVideoModel('definitely-missing-model')).toBe(false);
  });

  it('getRuntimeModelId returns runtimeModelId when present', () => {
    const withRuntime = DEFAULT_MODEL_LIST.find(
      (m) => 'runtimeModelId' in m && Boolean((m as { runtimeModelId?: string }).runtimeModelId),
    );
    expect(getRuntimeModelId('missing')).toBeNull();
    if (withRuntime) {
      expect(getRuntimeModelId(withRuntime.id)).toBe(
        (withRuntime as { runtimeModelId: string }).runtimeModelId,
      );
    } else {
      // still exercise false path when list has no runtime ids
      expect(getRuntimeModelId(DEFAULT_MODEL_LIST[0]!.id)).toBeNull();
    }
  });

  it('getRuntimeProvider returns runtimeProvider when present', () => {
    const withProvider = DEFAULT_MODEL_LIST.find(
      (m) => 'runtimeProvider' in m && Boolean((m as { runtimeProvider?: string }).runtimeProvider),
    );
    expect(getRuntimeProvider('missing')).toBeNull();
    if (withProvider) {
      expect(getRuntimeProvider(withProvider.id)).toBe(
        (withProvider as { runtimeProvider: string }).runtimeProvider,
      );
    } else {
      expect(getRuntimeProvider(DEFAULT_MODEL_LIST[0]!.id)).toBeNull();
    }
  });
});
