import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  usePromptInput,
} from './prompt-input';

vi.mock('@/hooks/use-translations', () => ({
  useTranslations: () => (key: string) => key,
}));

const { uploadFileMock } = vi.hoisted(() => ({ uploadFileMock: vi.fn() }));
vi.mock('@/libs/file-upload-api', () => ({
  uploadFile: (...args: unknown[]) => uploadFileMock(...args),
}));

describe('PromptInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    let counter = 0;
    vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() => {
      counter += 1;
      return `uuid-${counter}`;
    });

    Object.defineProperty(globalThis.URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:preview'),
    });
    Object.defineProperty(globalThis.URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('throws when usePromptInput is used outside provider', () => {
    function Consumer() {
      usePromptInput();
      return null;
    }

    expect(() => render(<Consumer />)).toThrow('usePromptInput must be used within a PromptInput');
  });

  it('submits on Enter (no shift)', () => {
    const onSubmit = vi.fn();

    render(
      <PromptInput
        value="hello"
        onChange={vi.fn()}
        onSubmit={onSubmit}
        uploadedImages={[]}
        onAddImages={vi.fn()}
        onUpdateImage={vi.fn()}
        onRemoveImage={vi.fn().mockResolvedValue(undefined)}
      >
        <PromptInputTextarea aria-label="prompt" />
      </PromptInput>,
    );

    fireEvent.keyDown(screen.getByLabelText('prompt'), { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not submit on Shift+Enter', () => {
    const onSubmit = vi.fn();

    render(
      <PromptInput
        value="hello"
        onChange={vi.fn()}
        onSubmit={onSubmit}
        uploadedImages={[]}
        onAddImages={vi.fn()}
        onUpdateImage={vi.fn()}
        onRemoveImage={vi.fn().mockResolvedValue(undefined)}
      >
        <PromptInputTextarea aria-label="prompt" />
      </PromptInput>,
    );

    fireEvent.keyDown(screen.getByLabelText('prompt'), { key: 'Enter', shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not submit when value is empty', () => {
    const onSubmit = vi.fn();

    render(
      <PromptInput
        value="   "
        onChange={vi.fn()}
        onSubmit={onSubmit}
        uploadedImages={[]}
        onAddImages={vi.fn()}
        onUpdateImage={vi.fn()}
        onRemoveImage={vi.fn().mockResolvedValue(undefined)}
      >
        <PromptInputTextarea aria-label="prompt" />
      </PromptInput>,
    );

    fireEvent.keyDown(screen.getByLabelText('prompt'), { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('debounces rapid submits', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));

    const onSubmit = vi.fn();

    render(
      <PromptInput
        value="hello"
        onChange={vi.fn()}
        onSubmit={onSubmit}
        uploadedImages={[]}
        onAddImages={vi.fn()}
        onUpdateImage={vi.fn()}
        onRemoveImage={vi.fn().mockResolvedValue(undefined)}
      >
        <PromptInputTextarea aria-label="prompt" />
      </PromptInput>,
    );

    fireEvent.keyDown(screen.getByLabelText('prompt'), { key: 'Enter' });
    fireEvent.keyDown(screen.getByLabelText('prompt'), { key: 'Enter' });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('renders stop button when loading and onStop provided', () => {
    const onStop = vi.fn();

    render(
      <PromptInput
        value="hello"
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onStop={onStop}
        isLoading
        uploadedImages={[]}
        onAddImages={vi.fn()}
        onUpdateImage={vi.fn()}
        onRemoveImage={vi.fn().mockResolvedValue(undefined)}
      >
        <PromptInputSubmit />
      </PromptInput>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('adds images on drop and uploads them', async () => {
    uploadFileMock.mockResolvedValue({ fileId: 'file-1', url: 'https://example.com/img.png' });

    const onAddImages = vi.fn();
    const onUpdateImage = vi.fn();

    const file = new File(['hello'], 'a.png', { type: 'image/png' });

    render(
      <PromptInput
        value="hello"
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        uploadedImages={[]}
        onAddImages={onAddImages}
        onUpdateImage={onUpdateImage}
        onRemoveImage={vi.fn().mockResolvedValue(undefined)}
      >
        <div data-testid="drop-target" />
      </PromptInput>,
    );

    fireEvent.drop(screen.getByTestId('drop-target').parentElement as HTMLElement, {
      dataTransfer: { files: [file], types: ['Files'] },
    });

    await waitFor(() => {
      expect(onAddImages).toHaveBeenCalledTimes(1);
    });
    const newImages = onAddImages.mock.calls[0]?.[0] as Array<{ id: string }>;
    expect(newImages[0]?.id).toBe('uuid-1');

    await waitFor(() => {
      expect(uploadFileMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(onUpdateImage).toHaveBeenCalledWith(
        'uuid-1',
        expect.objectContaining({
          fileId: 'file-1',
          url: 'https://example.com/img.png',
          isUploading: false,
        }),
      );
    });
  });

  it('limits added images to remaining slots', async () => {
    uploadFileMock.mockResolvedValue({ fileId: 'file-1', url: 'https://example.com/img.png' });

    const onAddImages = vi.fn();
    const onUpdateImage = vi.fn();
    const existing = Array.from({ length: 10 }, (_, i) => ({
      id: `existing-${i}`,
      file: new File(['x'], `x${i}.png`, { type: 'image/png' }),
      previewUrl: 'blob:existing',
      filename: `x${i}.png`,
      size: 1,
    }));

    const file = new File(['hello'], 'a.png', { type: 'image/png' });

    render(
      <PromptInput
        value="hello"
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        uploadedImages={existing}
        onAddImages={onAddImages}
        onUpdateImage={onUpdateImage}
        onRemoveImage={vi.fn().mockResolvedValue(undefined)}
      >
        <div data-testid="drop-target" />
      </PromptInput>,
    );

    fireEvent.drop(screen.getByTestId('drop-target').parentElement as HTMLElement, {
      dataTransfer: { files: [file], types: ['Files'] },
    });

    await waitFor(() => {
      expect(onAddImages).not.toHaveBeenCalled();
    });
  });

  it('marks upload errors and filters non-image files', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    uploadFileMock.mockRejectedValueOnce(new Error('upload boom'));

    const onAddImages = vi.fn();
    const onUpdateImage = vi.fn();
    const image = new File(['img'], 'a.png', { type: 'image/png' });
    const text = new File(['txt'], 'a.txt', { type: 'text/plain' });

    render(
      <PromptInput
        value="hello"
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        uploadedImages={[]}
        onAddImages={onAddImages}
        onUpdateImage={onUpdateImage}
        onRemoveImage={vi.fn().mockResolvedValue(undefined)}
      >
        <div data-testid="drop-target" />
      </PromptInput>,
    );

    fireEvent.drop(screen.getByTestId('drop-target').parentElement as HTMLElement, {
      dataTransfer: { files: [image, text], types: ['Files'] },
    });

    await waitFor(() => {
      expect(onAddImages).toHaveBeenCalledTimes(1);
    });
    expect(onAddImages.mock.calls[0]?.[0]).toHaveLength(1);

    await waitFor(() => {
      expect(onUpdateImage).toHaveBeenCalledWith(
        'uuid-1',
        expect.objectContaining({
          isUploading: false,
          uploadError: 'upload boom',
        }),
      );
    });
    errorSpy.mockRestore();
  });

  it('handles drag enter/leave/over and mode callbacks when images change', async () => {
    const onModeChange = vi.fn();
    const onRemoveImage = vi.fn().mockResolvedValue(undefined);

    const { rerender } = render(
      <PromptInput
        value="hello"
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onModeChange={onModeChange}
        uploadedImages={[]}
        onAddImages={vi.fn()}
        onUpdateImage={vi.fn()}
        onRemoveImage={onRemoveImage}
      >
        <div data-testid="drop-target" />
      </PromptInput>,
    );

    const root = screen.getByTestId('drop-target').parentElement as HTMLElement;
    fireEvent.dragEnter(root, { dataTransfer: { types: ['Files'] } });
    fireEvent.dragOver(root, { dataTransfer: { types: ['Files'] } });
    fireEvent.dragLeave(root, {
      dataTransfer: { types: ['Files'] },
      relatedTarget: document.body,
    });

    const img = {
      id: 'img-1',
      file: new File(['x'], 'x.png', { type: 'image/png' }),
      previewUrl: 'blob:x',
      filename: 'x.png',
      size: 1,
    };

    rerender(
      <PromptInput
        value="hello"
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onModeChange={onModeChange}
        uploadedImages={[img]}
        onAddImages={vi.fn()}
        onUpdateImage={vi.fn()}
        onRemoveImage={onRemoveImage}
      >
        <div data-testid="drop-target" />
      </PromptInput>,
    );

    await waitFor(() => {
      expect(onModeChange).toHaveBeenCalledWith('upload');
    });

    // expose remove via consumer if available through context children would need export;
    // cover empty drop path
    fireEvent.drop(root, {
      dataTransfer: { files: [], types: ['Files'] },
    });
  });

  it('does not submit while loading or disabled', () => {
    const onSubmit = vi.fn();
    const { rerender } = render(
      <PromptInput
        value="hello"
        onChange={vi.fn()}
        onSubmit={onSubmit}
        isLoading
        uploadedImages={[]}
        onAddImages={vi.fn()}
        onUpdateImage={vi.fn()}
        onRemoveImage={vi.fn().mockResolvedValue(undefined)}
      >
        <PromptInputTextarea aria-label="prompt" />
      </PromptInput>,
    );
    fireEvent.keyDown(screen.getByLabelText('prompt'), { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();

    rerender(
      <PromptInput
        value="hello"
        onChange={vi.fn()}
        onSubmit={onSubmit}
        disabled
        uploadedImages={[]}
        onAddImages={vi.fn()}
        onUpdateImage={vi.fn()}
        onRemoveImage={vi.fn().mockResolvedValue(undefined)}
      >
        <PromptInputTextarea aria-label="prompt" />
      </PromptInput>,
    );
    fireEvent.keyDown(screen.getByLabelText('prompt'), { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
