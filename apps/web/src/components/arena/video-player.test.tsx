import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const plyrMock = vi.hoisted(() => {
  let lastOptions: {
    listeners?: { download?: (event: Event) => void };
    urls?: { download?: string };
  } | null = null;
  const component = vi.fn(
    ({
      source,
      options,
    }: {
      source: unknown;
      options: { listeners?: { download?: (e: Event) => void } };
    }) => {
      lastOptions = options;
      return (
        <div
          data-testid="plyr"
          data-source={JSON.stringify(source)}
          data-options={JSON.stringify({
            controls: (options as { controls?: string[] }).controls,
            ratio: (options as { ratio?: string }).ratio,
            urls: (options as { urls?: { download?: string } }).urls,
          })}
        />
      );
    },
  );
  return {
    component,
    getLastOptions: () => lastOptions,
    reset: () => {
      lastOptions = null;
    },
  };
});

vi.mock('next/dynamic', () => ({
  default: () => plyrMock.component,
}));

import { VideoPlayer } from './video-player';

describe('VideoPlayer', () => {
  afterEach(() => {
    plyrMock.reset();
    vi.restoreAllMocks();
  });

  it('renders Plyr with video source and poster', () => {
    render(
      <VideoPlayer
        url="https://cdn.example.com/v.mp4"
        thumbnailUrl="https://cdn.example.com/t.jpg"
        className="player"
      />,
    );

    const el = document.querySelector('[data-testid="plyr"]');
    expect(el).toBeTruthy();
    expect(el?.getAttribute('data-source')).toContain('https://cdn.example.com/v.mp4');
    expect(el?.getAttribute('data-source')).toContain('https://cdn.example.com/t.jpg');
    expect(el?.getAttribute('data-options')).toContain('16:9');
    expect(el?.getAttribute('data-options')).toContain('download');
  });

  it('downloads video via listeners.download handler', async () => {
    const blob = new Blob(['video-bytes'], { type: 'video/mp4' });
    const fetchMock = vi.fn().mockResolvedValue({
      blob: () => Promise.resolve(blob),
    });
    vi.stubGlobal('fetch', fetchMock);

    const createObjectURL = vi.fn(() => 'blob:video');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });

    const click = vi.fn();
    const appendChild = vi.spyOn(document.body, 'appendChild');
    const removeChild = vi.spyOn(document.body, 'removeChild');
    const originalCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreate(tag);
      if (tag === 'a') {
        Object.defineProperty(el, 'click', { value: click });
      }
      return el;
    });

    render(<VideoPlayer url="https://cdn.example.com/download.mp4" />);
    const download = plyrMock.getLastOptions()?.listeners?.download;
    expect(download).toBeTypeOf('function');

    const event = new Event('click');
    const preventDefault = vi.spyOn(event, 'preventDefault');

    await act(async () => {
      download?.(event);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith('https://cdn.example.com/download.mp4');
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalled();
    expect(appendChild).toHaveBeenCalled();
    expect(removeChild).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:video');
  });

  it('renders without thumbnail', () => {
    render(<VideoPlayer url="https://cdn.example.com/bare.mp4" />);
    const el = document.querySelector('[data-testid="plyr"]');
    expect(el?.getAttribute('data-source')).toContain('https://cdn.example.com/bare.mp4');
  });
});
