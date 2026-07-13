import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as videoWorkflowApiModule from '@/libs/video-workflow-api';
import * as workflowApiModule from '@/libs/workflow-api';
import * as workflowStoreModule from '@/stores/workflow-store';
import type { ArenaWorkflow, WorkflowStatus } from '@/types/workflow';
import { useWorkflowExecution } from './use-workflow-execution';

describe('useWorkflowExecution', () => {
  let useWorkflowStoreSpy: ReturnType<typeof vi.spyOn>;
  let streamWorkflowSpy: ReturnType<typeof vi.spyOn>;
  let streamVideoWorkflowSpy: ReturnType<typeof vi.spyOn>;
  let buildWorkflowStreamRequestSpy: ReturnType<typeof vi.spyOn>;
  let buildVideoStreamRequestSpy: ReturnType<typeof vi.spyOn>;

  const mockWorkflow: ArenaWorkflow = {
    id: 'workflow-1',
    modelId: 'openai:gpt-4',
    keyId: 'key-1',
    synced: true,
    status: 'idle' as WorkflowStatus,
    messages: [],
    pendingResponse: undefined,
    config: {
      temperature: 0.7,
      maxTokens: 4096,
    },
    customPrompt: '',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStoreFunctions = {
    addUserMessage: vi.fn(),
    startPendingResponse: vi.fn(),
    appendPendingResponse: vi.fn(),
    appendPendingReasoning: vi.fn(),
    completePendingResponse: vi.fn(),
    setWorkflowStatus: vi.fn(),
    setAbortController: vi.fn(),
    getAbortController: vi.fn(),
    getWorkflow: vi.fn(),
    getSyncedWorkflows: vi.fn(),
    getGlobalPrompt: vi.fn().mockReturnValue('Test prompt'),
    clearWorkflowHistory: vi.fn(),
    removeLastAssistantMessage: vi.fn(),
    getConversationId: vi.fn().mockReturnValue(null),
    setConversationId: vi.fn(),
    setVideoGenerating: vi.fn(),
    completeVideoResponse: vi.fn(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    useWorkflowStoreSpy = vi.spyOn(workflowStoreModule, 'useWorkflowStore');
    useWorkflowStoreSpy.mockImplementation((selector: (state: unknown) => unknown) => {
      const state = {
        ...mockStoreFunctions,
      };
      return selector(state);
    });

    buildWorkflowStreamRequestSpy = vi
      .spyOn(workflowApiModule, 'buildWorkflowStreamRequest')
      .mockReturnValue({
        workflowId: 'workflow-1',
        modelId: 'gpt-4',
        keyId: 'key-1',
        messages: [],
        config: { temperature: 0.7, maxTokens: 4096 },
      });

    buildVideoStreamRequestSpy = vi
      .spyOn(videoWorkflowApiModule, 'buildVideoStreamRequest')
      .mockReturnValue({
        workflowId: 'workflow-1',
        modelId: 'openai:sora',
        keyId: 'key-1',
        prompt: 'make a video',
      } as never);

    streamWorkflowSpy = vi.spyOn(workflowApiModule, 'streamWorkflow');
    streamVideoWorkflowSpy = vi.spyOn(videoWorkflowApiModule, 'streamVideoWorkflow');

    Object.values(mockStoreFunctions).forEach((fn) => {
      if (typeof fn === 'function') {
        fn.mockClear?.();
      }
    });

    mockStoreFunctions.getWorkflow.mockReturnValue(mockWorkflow);
    mockStoreFunctions.getSyncedWorkflows.mockReturnValue([mockWorkflow]);
    mockStoreFunctions.getAbortController.mockReturnValue(undefined);
    mockStoreFunctions.getConversationId.mockReturnValue(null);
    mockStoreFunctions.getGlobalPrompt.mockReturnValue('Test prompt');

    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('startWorkflow', () => {
    it('validates workflow exists', async () => {
      mockStoreFunctions.getWorkflow.mockReturnValue(undefined);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useWorkflowExecution());

      await act(async () => {
        await result.current.startWorkflow('non-existent', 'prompt');
      });

      expect(errorSpy).toHaveBeenCalledWith('Workflow not found:', 'non-existent');
      errorSpy.mockRestore();
    });

    it('validates workflow is not already running', async () => {
      mockStoreFunctions.getWorkflow.mockReturnValue({ ...mockWorkflow, status: 'running' });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useWorkflowExecution());

      await act(async () => {
        await result.current.startWorkflow('workflow-1', 'prompt');
      });

      expect(warnSpy).toHaveBeenCalledWith('Workflow already running:', 'workflow-1');
      warnSpy.mockRestore();
    });

    it('validates prompt is not empty', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useWorkflowExecution());

      await act(async () => {
        await result.current.startWorkflow('workflow-1', '  ');
      });

      expect(warnSpy).toHaveBeenCalledWith('Empty prompt provided');
      warnSpy.mockRestore();
    });

    it('executes workflow stream successfully', async () => {
      async function* mockStream() {
        yield { type: 'chunk' as const, workflowId: 'workflow-1', chunk: 'Hello' };
        yield { type: 'complete' as const, workflowId: 'workflow-1', metrics: { totalTokens: 10 } };
      }

      streamWorkflowSpy.mockReturnValue(mockStream());

      const { result } = renderHook(() => useWorkflowExecution());

      await act(async () => {
        await result.current.startWorkflow('workflow-1', 'Test prompt');
      });

      expect(mockStoreFunctions.addUserMessage).toHaveBeenCalledWith(
        'workflow-1',
        'Test prompt',
        undefined,
      );
      expect(mockStoreFunctions.startPendingResponse).toHaveBeenCalledWith('workflow-1');
      expect(mockStoreFunctions.appendPendingResponse).toHaveBeenCalledWith('workflow-1', 'Hello');
      expect(mockStoreFunctions.completePendingResponse).toHaveBeenCalled();
    });
  });

  describe('continueWorkflow', () => {
    it('validates workflow exists', async () => {
      mockStoreFunctions.getWorkflow.mockReturnValue(undefined);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useWorkflowExecution());

      await act(async () => {
        await result.current.continueWorkflow('non-existent', 'follow-up');
      });

      expect(errorSpy).toHaveBeenCalledWith('Workflow not found:', 'non-existent');
      errorSpy.mockRestore();
    });

    it('validates workflow is not running', async () => {
      mockStoreFunctions.getWorkflow.mockReturnValue({ ...mockWorkflow, status: 'running' });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useWorkflowExecution());

      await act(async () => {
        await result.current.continueWorkflow('workflow-1', 'follow-up');
      });

      expect(warnSpy).toHaveBeenCalledWith('Workflow already running:', 'workflow-1');
      warnSpy.mockRestore();
    });

    it('validates follow-up prompt is not empty', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useWorkflowExecution());

      await act(async () => {
        await result.current.continueWorkflow('workflow-1', '');
      });

      expect(warnSpy).toHaveBeenCalledWith('Empty follow-up prompt provided');
      warnSpy.mockRestore();
    });
  });

  describe('cancelWorkflow', () => {
    it('aborts controller and sets cancelled status', () => {
      const mockController = { abort: vi.fn() };
      mockStoreFunctions.getAbortController.mockReturnValue(mockController);

      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.cancelWorkflow('workflow-1');
      });

      expect(mockController.abort).toHaveBeenCalled();
      expect(mockStoreFunctions.setAbortController).toHaveBeenCalledWith('workflow-1', undefined);
      expect(mockStoreFunctions.setWorkflowStatus).toHaveBeenCalledWith('workflow-1', 'cancelled');
    });

    it('does nothing when no abort controller exists', () => {
      mockStoreFunctions.getAbortController.mockReturnValue(undefined);

      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.cancelWorkflow('workflow-1');
      });

      expect(mockStoreFunctions.setWorkflowStatus).not.toHaveBeenCalled();
    });
  });

  describe('retryWorkflow', () => {
    it('validates workflow exists', async () => {
      mockStoreFunctions.getWorkflow.mockReturnValue(undefined);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useWorkflowExecution());

      await act(async () => {
        await result.current.retryWorkflow('non-existent');
      });

      expect(errorSpy).toHaveBeenCalledWith('Workflow not found:', 'non-existent');
      errorSpy.mockRestore();
    });

    it('only retries failed workflows', async () => {
      mockStoreFunctions.getWorkflow.mockReturnValue({ ...mockWorkflow, status: 'idle' });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useWorkflowExecution());

      await act(async () => {
        await result.current.retryWorkflow('workflow-1');
      });

      expect(warnSpy).toHaveBeenCalledWith('Can only retry failed or cancelled workflows');
      warnSpy.mockRestore();
    });

    it('only retries cancelled workflows', async () => {
      const failedWorkflow = {
        ...mockWorkflow,
        status: 'cancelled' as WorkflowStatus,
        messages: [{ id: 'msg-1', role: 'user' as const, content: 'Test', createdAt: new Date() }],
      };
      mockStoreFunctions.getWorkflow.mockReturnValue(failedWorkflow);

      async function* mockStream() {
        yield { type: 'complete' as const, workflowId: 'workflow-1' };
      }
      streamWorkflowSpy.mockReturnValue(mockStream());

      const { result } = renderHook(() => useWorkflowExecution());

      await act(async () => {
        await result.current.retryWorkflow('workflow-1');
      });

      expect(mockStoreFunctions.clearWorkflowHistory).toHaveBeenCalledWith('workflow-1');
    });

    it('warns when no user message to retry', async () => {
      mockStoreFunctions.getWorkflow.mockReturnValue({
        ...mockWorkflow,
        status: 'failed' as WorkflowStatus,
        messages: [],
      });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useWorkflowExecution());

      await act(async () => {
        await result.current.retryWorkflow('workflow-1');
      });

      expect(warnSpy).toHaveBeenCalledWith('No user message to retry');
      warnSpy.mockRestore();
    });
  });

  describe('regenerateLastResponse', () => {
    it('validates workflow exists', async () => {
      mockStoreFunctions.getWorkflow.mockReturnValue(undefined);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useWorkflowExecution());

      await act(async () => {
        await result.current.regenerateLastResponse('non-existent');
      });

      expect(errorSpy).toHaveBeenCalledWith('Workflow not found:', 'non-existent');
      errorSpy.mockRestore();
    });

    it('validates workflow is not running', async () => {
      mockStoreFunctions.getWorkflow.mockReturnValue({ ...mockWorkflow, status: 'running' });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useWorkflowExecution());

      await act(async () => {
        await result.current.regenerateLastResponse('workflow-1');
      });

      expect(warnSpy).toHaveBeenCalledWith('Workflow is currently running:', 'workflow-1');
      warnSpy.mockRestore();
    });

    it('warns when no user message found', async () => {
      mockStoreFunctions.removeLastAssistantMessage.mockReturnValue(undefined);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useWorkflowExecution());

      await act(async () => {
        await result.current.regenerateLastResponse('workflow-1');
      });

      expect(warnSpy).toHaveBeenCalledWith('No user message found to regenerate response');
      warnSpy.mockRestore();
    });

    it('removes last assistant message and re-executes', async () => {
      mockStoreFunctions.removeLastAssistantMessage.mockReturnValue('Previous user content');

      async function* mockStream() {
        yield { type: 'complete' as const, workflowId: 'workflow-1' };
      }
      streamWorkflowSpy.mockReturnValue(mockStream());

      const { result } = renderHook(() => useWorkflowExecution());

      await act(async () => {
        await result.current.regenerateLastResponse('workflow-1');
      });

      expect(mockStoreFunctions.removeLastAssistantMessage).toHaveBeenCalledWith('workflow-1');
      expect(mockStoreFunctions.addUserMessage).toHaveBeenCalled();
    });
  });

  describe('startAllSyncedWorkflows', () => {
    it('validates global prompt is not empty', async () => {
      mockStoreFunctions.getGlobalPrompt.mockReturnValue('  ');

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useWorkflowExecution());

      await act(async () => {
        await result.current.startAllSyncedWorkflows();
      });

      expect(warnSpy).toHaveBeenCalledWith('Empty global prompt');
      warnSpy.mockRestore();
    });

    it('warns when no runnable synced workflows', async () => {
      mockStoreFunctions.getSyncedWorkflows.mockReturnValue([
        { ...mockWorkflow, status: 'running' },
      ]);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useWorkflowExecution());

      await act(async () => {
        await result.current.startAllSyncedWorkflows();
      });

      expect(warnSpy).toHaveBeenCalledWith('No runnable synced workflows');
      warnSpy.mockRestore();
    });

    it('executes all synced workflows in parallel', async () => {
      mockStoreFunctions.getSyncedWorkflows.mockReturnValue([
        mockWorkflow,
        { ...mockWorkflow, id: 'workflow-2' },
      ]);

      async function* mockStream() {
        yield { type: 'complete' as const, workflowId: 'workflow-1' };
      }
      streamWorkflowSpy.mockReturnValue(mockStream());

      const { result } = renderHook(() => useWorkflowExecution());

      await act(async () => {
        await result.current.startAllSyncedWorkflows();
      });

      expect(mockStoreFunctions.addUserMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe('continueAllSyncedWorkflows', () => {
    it('validates follow-up prompt is not empty', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useWorkflowExecution());

      await act(async () => {
        await result.current.continueAllSyncedWorkflows('');
      });

      expect(warnSpy).toHaveBeenCalledWith('Empty follow-up prompt');
      warnSpy.mockRestore();
    });

    it('warns when no runnable synced workflows', async () => {
      mockStoreFunctions.getSyncedWorkflows.mockReturnValue([
        { ...mockWorkflow, status: 'running' },
      ]);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useWorkflowExecution());

      await act(async () => {
        await result.current.continueAllSyncedWorkflows('follow-up');
      });

      expect(warnSpy).toHaveBeenCalledWith('No runnable synced workflows');
      warnSpy.mockRestore();
    });

    it('continues all synced workflows in parallel', async () => {
      mockStoreFunctions.getSyncedWorkflows.mockReturnValue([
        mockWorkflow,
        { ...mockWorkflow, id: 'workflow-2' },
      ]);

      async function* mockStream() {
        yield { type: 'complete' as const, workflowId: 'workflow-1' };
      }
      streamWorkflowSpy.mockReturnValue(mockStream());

      const { result } = renderHook(() => useWorkflowExecution());

      await act(async () => {
        await result.current.continueAllSyncedWorkflows('follow-up');
      });

      expect(mockStoreFunctions.addUserMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe('cancelAllWorkflows', () => {
    it('cancels all running workflows', () => {
      const mockController1 = { abort: vi.fn() };
      const mockController2 = { abort: vi.fn() };

      mockStoreFunctions.getSyncedWorkflows.mockReturnValue([
        { ...mockWorkflow, id: 'workflow-1', status: 'running' },
        { ...mockWorkflow, id: 'workflow-2', status: 'running' },
        { ...mockWorkflow, id: 'workflow-3', status: 'idle' },
      ]);

      let callCount = 0;
      mockStoreFunctions.getAbortController.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return mockController1;
        return mockController2;
      });

      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.cancelAllWorkflows();
      });

      expect(mockController1.abort).toHaveBeenCalled();
      expect(mockController2.abort).toHaveBeenCalled();
      expect(mockStoreFunctions.setWorkflowStatus).toHaveBeenCalledTimes(2);
    });

    it('does nothing when no running workflows', () => {
      mockStoreFunctions.getSyncedWorkflows.mockReturnValue([{ ...mockWorkflow, status: 'idle' }]);

      const { result } = renderHook(() => useWorkflowExecution());

      act(() => {
        result.current.cancelAllWorkflows();
      });

      expect(mockStoreFunctions.setWorkflowStatus).not.toHaveBeenCalled();
    });
  });

  describe('stream event handling', () => {
    it('handles reasoning events', async () => {
      async function* mockStream() {
        yield { type: 'reasoning' as const, workflowId: 'workflow-1', reasoning: 'Thinking...' };
        yield { type: 'complete' as const, workflowId: 'workflow-1' };
      }
      streamWorkflowSpy.mockReturnValue(mockStream());

      const { result } = renderHook(() => useWorkflowExecution());

      await act(async () => {
        await result.current.startWorkflow('workflow-1', 'Test');
      });

      expect(mockStoreFunctions.appendPendingReasoning).toHaveBeenCalledWith(
        'workflow-1',
        'Thinking...',
      );
    });

    it('handles error events', async () => {
      async function* mockStream() {
        yield { type: 'error' as const, workflowId: 'workflow-1', error: 'API error' };
      }
      streamWorkflowSpy.mockReturnValue(mockStream());

      const { result } = renderHook(() => useWorkflowExecution());

      await act(async () => {
        await result.current.startWorkflow('workflow-1', 'Test');
      });

      expect(mockStoreFunctions.setWorkflowStatus).toHaveBeenCalledWith(
        'workflow-1',
        'failed',
        'API error',
      );
    });

    it('handles AbortError correctly', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';

      async function* mockStream() {
        yield { type: 'chunk' as const, workflowId: 'workflow-1', chunk: '' };
        throw abortError;
      }
      streamWorkflowSpy.mockReturnValue(mockStream());

      const { result } = renderHook(() => useWorkflowExecution());

      await act(async () => {
        await result.current.startWorkflow('workflow-1', 'Test');
      });

      expect(mockStoreFunctions.setWorkflowStatus).toHaveBeenCalledWith('workflow-1', 'cancelled');
    });

    it('handles unknown errors', async () => {
      async function* mockStream() {
        yield { type: 'chunk' as const, workflowId: 'workflow-1', chunk: '' };
        throw new Error('Unknown error');
      }
      streamWorkflowSpy.mockReturnValue(mockStream());

      const { result } = renderHook(() => useWorkflowExecution());

      await act(async () => {
        await result.current.startWorkflow('workflow-1', 'Test');
      });

      expect(mockStoreFunctions.setWorkflowStatus).toHaveBeenCalledWith(
        'workflow-1',
        'failed',
        'Unknown error',
      );
    });

    it('handles non-Error thrown values', async () => {
      async function* mockStream() {
        yield* [];
        throw 'string-error';
      }
      streamWorkflowSpy.mockReturnValue(mockStream());

      const { result } = renderHook(() => useWorkflowExecution());

      await act(async () => {
        await result.current.startWorkflow('workflow-1', 'Test');
      });

      expect(mockStoreFunctions.setWorkflowStatus).toHaveBeenCalledWith(
        'workflow-1',
        'failed',
        'Unknown error',
      );
    });

    it('passes extended config and attachments to stream request', async () => {
      const workflowWithConfig = {
        ...mockWorkflow,
        config: {
          temperature: 0.5,
          maxTokens: 1024,
          topP: 0.9,
          frequencyPenalty: 0.1,
          presencePenalty: 0.2,
        },
      };
      mockStoreFunctions.getWorkflow.mockReturnValue(workflowWithConfig);
      mockStoreFunctions.getSyncedWorkflows.mockReturnValue([workflowWithConfig]);

      async function* mockStream() {
        yield { type: 'complete' as const, workflowId: 'workflow-1' };
      }
      streamWorkflowSpy.mockReturnValue(mockStream());

      const { result } = renderHook(() => useWorkflowExecution());

      await act(async () => {
        await result.current.startAllSyncedWorkflows([
          {
            type: 'image' as const,
            data: 'data:image/png;base64,abc',
            mediaType: 'image/png',
            filename: 'shot.png',
          },
        ]);
      });

      expect(buildWorkflowStreamRequestSpy).toHaveBeenCalledWith(
        'workflow-1',
        'openai:gpt-4',
        'key-1',
        expect.any(Array),
        expect.objectContaining({
          temperature: 0.5,
          maxTokens: 1024,
          topP: 0.9,
          frequencyPenalty: 0.1,
          presencePenalty: 0.2,
        }),
        [
          {
            type: 'image',
            data: 'data:image/png;base64,abc',
            mediaType: 'image/png',
            filename: 'shot.png',
          },
        ],
      );
      expect(mockStoreFunctions.addUserMessage).toHaveBeenCalledWith('workflow-1', 'Test prompt', [
        {
          type: 'file',
          url: 'data:image/png;base64,abc',
          mediaType: 'image/png',
          filename: 'shot.png',
        },
      ]);
    });
  });

  describe('persistence callbacks', () => {
    it('saves user message for existing conversation when starting all synced workflows', async () => {
      mockStoreFunctions.getConversationId.mockReturnValue('conv-existing');
      const onSaveUserMessage = vi.fn().mockResolvedValue('msg-1');
      const onSaveModelResponse = vi.fn().mockResolvedValue(undefined);

      async function* mockStream() {
        yield { type: 'chunk' as const, workflowId: 'workflow-1', chunk: 'Hi' };
        yield {
          type: 'complete' as const,
          workflowId: 'workflow-1',
          metrics: { totalTokens: 5, totalTime: 100 },
        };
      }
      streamWorkflowSpy.mockReturnValue(mockStream());

      const { result } = renderHook(() =>
        useWorkflowExecution({ onSaveUserMessage, onSaveModelResponse }),
      );

      await act(async () => {
        await result.current.startAllSyncedWorkflows(undefined, [
          { type: 'image', fileId: 'f1', mimeType: 'image/png' },
        ]);
      });

      expect(onSaveUserMessage).toHaveBeenCalledWith('conv-existing', 'Test prompt', [
        { type: 'image', fileId: 'f1', mimeType: 'image/png' },
      ]);
      expect(onSaveModelResponse).toHaveBeenCalledWith(
        'workflow-1',
        'msg-1',
        'gpt-4',
        'openai',
        'Hi',
        5,
        100,
      );
    });

    it('creates conversation on first chunk for new conversation', async () => {
      const onCreateConversation = vi.fn().mockResolvedValue('conv-new');
      const onSaveUserMessage = vi.fn().mockResolvedValue('msg-new');
      const onConversationCreated = vi.fn();
      const onSaveModelResponse = vi.fn().mockResolvedValue(undefined);

      async function* mockStream() {
        yield { type: 'chunk' as const, workflowId: 'workflow-1', chunk: 'Hello world' };
        yield { type: 'complete' as const, workflowId: 'workflow-1' };
      }
      streamWorkflowSpy.mockReturnValue(mockStream());

      const { result } = renderHook(() =>
        useWorkflowExecution({
          onCreateConversation,
          onSaveUserMessage,
          onConversationCreated,
          onSaveModelResponse,
        }),
      );

      await act(async () => {
        await result.current.startAllSyncedWorkflows();
      });

      expect(onCreateConversation).toHaveBeenCalledWith('Test prompt');
      expect(mockStoreFunctions.setConversationId).toHaveBeenCalledWith('conv-new');
      expect(onSaveUserMessage).toHaveBeenCalledWith('conv-new', 'Test prompt', undefined);
      expect(onConversationCreated).toHaveBeenCalledWith('conv-new', 'Test prompt');
      expect(onSaveModelResponse).toHaveBeenCalledWith(
        'workflow-1',
        'msg-new',
        'gpt-4',
        'openai',
        'Hello world',
        undefined,
        undefined,
      );
    });

    it('truncates long conversation titles and handles create failure', async () => {
      const longPrompt = 'a'.repeat(60);
      mockStoreFunctions.getGlobalPrompt.mockReturnValue(longPrompt);
      const onCreateConversation = vi.fn().mockResolvedValue(null);

      async function* mockStream() {
        yield { type: 'chunk' as const, workflowId: 'workflow-1', chunk: 'x' };
        yield { type: 'complete' as const, workflowId: 'workflow-1' };
      }
      streamWorkflowSpy.mockReturnValue(mockStream());

      const { result } = renderHook(() => useWorkflowExecution({ onCreateConversation }));

      await act(async () => {
        await result.current.startAllSyncedWorkflows();
      });

      expect(onCreateConversation).toHaveBeenCalledWith(`${'a'.repeat(50)}...`);
      expect(mockStoreFunctions.setConversationId).not.toHaveBeenCalled();
    });

    it('logs when saving model response fails', async () => {
      mockStoreFunctions.getConversationId.mockReturnValue('conv-1');
      const onSaveUserMessage = vi.fn().mockResolvedValue('msg-1');
      const onSaveModelResponse = vi.fn().mockRejectedValue(new Error('db down'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      async function* mockStream() {
        yield { type: 'chunk' as const, workflowId: 'workflow-1', chunk: 'content' };
        yield { type: 'complete' as const, workflowId: 'workflow-1' };
      }
      streamWorkflowSpy.mockReturnValue(mockStream());

      const { result } = renderHook(() =>
        useWorkflowExecution({ onSaveUserMessage, onSaveModelResponse }),
      );

      await act(async () => {
        await result.current.startAllSyncedWorkflows();
      });

      expect(errorSpy).toHaveBeenCalledWith('Failed to save model response:', expect.any(Error));
      errorSpy.mockRestore();
    });

    it('handles existing conversation when onSaveUserMessage returns null', async () => {
      mockStoreFunctions.getConversationId.mockReturnValue('conv-1');
      const onSaveUserMessage = vi.fn().mockResolvedValue(null);
      const onSaveModelResponse = vi.fn();

      async function* mockStream() {
        yield { type: 'chunk' as const, workflowId: 'workflow-1', chunk: 'x' };
        yield { type: 'complete' as const, workflowId: 'workflow-1' };
      }
      streamWorkflowSpy.mockReturnValue(mockStream());

      const { result } = renderHook(() =>
        useWorkflowExecution({ onSaveUserMessage, onSaveModelResponse }),
      );

      await act(async () => {
        await result.current.startAllSyncedWorkflows();
      });

      expect(onSaveModelResponse).not.toHaveBeenCalled();
    });
  });

  describe('startAllSyncedVideoWorkflows', () => {
    const videoWorkflow: ArenaWorkflow = {
      ...mockWorkflow,
      id: 'video-1',
      modelId: 'openai:sora',
    };

    it('validates empty prompt and no runnable workflows', async () => {
      mockStoreFunctions.getGlobalPrompt.mockReturnValue('  ');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useWorkflowExecution());

      await act(async () => {
        await result.current.startAllSyncedVideoWorkflows();
      });
      expect(warnSpy).toHaveBeenCalledWith('Empty global prompt');

      mockStoreFunctions.getGlobalPrompt.mockReturnValue('video prompt');
      mockStoreFunctions.getSyncedWorkflows.mockReturnValue([
        { ...videoWorkflow, status: 'running' },
      ]);

      await act(async () => {
        await result.current.startAllSyncedVideoWorkflows();
      });
      expect(warnSpy).toHaveBeenCalledWith('No runnable synced workflows');
      warnSpy.mockRestore();
    });

    it('streams video, completes with attachment, and persists response', async () => {
      mockStoreFunctions.getSyncedWorkflows.mockReturnValue([videoWorkflow]);
      mockStoreFunctions.getConversationId.mockReturnValue('conv-v');
      const onSaveUserMessage = vi.fn().mockResolvedValue('msg-v');
      const onSaveModelResponse = vi.fn().mockResolvedValue(undefined);

      async function* mockVideoStream() {
        yield { type: 'heartbeat' as const, workflowId: 'video-1' };
        yield {
          type: 'video' as const,
          workflowId: 'video-1',
          video: {
            url: 'https://cdn.example/v.mp4',
            storagePath: 'videos/v.mp4',
            mimeType: 'video/mp4',
            thumbnailUrl: 'https://cdn.example/t.jpg',
          },
        };
        yield {
          type: 'complete' as const,
          workflowId: 'video-1',
          metrics: { totalTime: 2500 },
        };
      }
      streamVideoWorkflowSpy.mockReturnValue(mockVideoStream());

      const { result } = renderHook(() =>
        useWorkflowExecution({ onSaveUserMessage, onSaveModelResponse }),
      );

      await act(async () => {
        await result.current.startAllSyncedVideoWorkflows();
      });

      expect(buildVideoStreamRequestSpy).toHaveBeenCalledWith(
        'video-1',
        'openai:sora',
        'key-1',
        'Test prompt',
      );
      expect(mockStoreFunctions.setVideoGenerating).toHaveBeenCalledWith('video-1', true);
      expect(mockStoreFunctions.completeVideoResponse).toHaveBeenCalledWith(
        'video-1',
        expect.objectContaining({
          url: 'https://cdn.example/v.mp4',
          storagePath: 'videos/v.mp4',
          mimeType: 'video/mp4',
        }),
        { totalTime: 2500 },
      );
      expect(onSaveModelResponse).toHaveBeenCalledWith(
        'video-1',
        'msg-v',
        'sora',
        'openai',
        '[video](https://cdn.example/v.mp4)',
        undefined,
        2500,
        [
          expect.objectContaining({
            type: 'video',
            key: 'videos/v.mp4',
            mimeType: 'video/mp4',
            url: 'https://cdn.example/v.mp4',
          }),
        ],
      );
    });

    it('fails when no video is received', async () => {
      mockStoreFunctions.getSyncedWorkflows.mockReturnValue([videoWorkflow]);

      async function* mockVideoStream() {
        yield { type: 'complete' as const, workflowId: 'video-1' };
      }
      streamVideoWorkflowSpy.mockReturnValue(mockVideoStream());

      const { result } = renderHook(() => useWorkflowExecution());

      await act(async () => {
        await result.current.startAllSyncedVideoWorkflows();
      });

      expect(mockStoreFunctions.setWorkflowStatus).toHaveBeenCalledWith(
        'video-1',
        'failed',
        'No video received',
      );
    });

    it('handles video error events and AbortError', async () => {
      mockStoreFunctions.getSyncedWorkflows.mockReturnValue([videoWorkflow]);

      async function* errorStream() {
        yield { type: 'error' as const, workflowId: 'video-1', error: 'video failed' };
      }
      streamVideoWorkflowSpy.mockReturnValue(errorStream());

      const { result } = renderHook(() => useWorkflowExecution());

      await act(async () => {
        await result.current.startAllSyncedVideoWorkflows();
      });
      expect(mockStoreFunctions.setWorkflowStatus).toHaveBeenCalledWith(
        'video-1',
        'failed',
        'video failed',
      );

      const abortError = new Error('aborted');
      abortError.name = 'AbortError';
      async function* abortStream() {
        yield* [];
        throw abortError;
      }
      streamVideoWorkflowSpy.mockReturnValue(abortStream());
      mockStoreFunctions.setWorkflowStatus.mockClear();

      await act(async () => {
        await result.current.startAllSyncedVideoWorkflows();
      });
      expect(mockStoreFunctions.setWorkflowStatus).toHaveBeenCalledWith('video-1', 'cancelled');
    });

    it('creates conversation on first video heartbeat and logs save failures', async () => {
      mockStoreFunctions.getSyncedWorkflows.mockReturnValue([videoWorkflow]);
      mockStoreFunctions.getConversationId.mockReturnValue(null);
      const onCreateConversation = vi.fn().mockResolvedValue('conv-video');
      const onSaveUserMessage = vi.fn().mockResolvedValue('msg-video');
      const onConversationCreated = vi.fn();
      const onSaveModelResponse = vi.fn().mockRejectedValue(new Error('save fail'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      async function* mockVideoStream() {
        yield { type: 'heartbeat' as const, workflowId: 'video-1' };
        yield {
          type: 'video' as const,
          workflowId: 'video-1',
          video: {
            url: 'https://cdn.example/v2.mp4',
            mimeType: 'video/mp4',
          },
        };
        yield { type: 'complete' as const, workflowId: 'video-1' };
      }
      streamVideoWorkflowSpy.mockReturnValue(mockVideoStream());

      const { result } = renderHook(() =>
        useWorkflowExecution({
          onCreateConversation,
          onSaveUserMessage,
          onConversationCreated,
          onSaveModelResponse,
        }),
      );

      await act(async () => {
        await result.current.startAllSyncedVideoWorkflows();
      });

      expect(onCreateConversation).toHaveBeenCalled();
      expect(onConversationCreated).toHaveBeenCalledWith('conv-video', 'Test prompt');
      expect(errorSpy).toHaveBeenCalledWith('Failed to save video response:', expect.any(Error));
      errorSpy.mockRestore();
    });

    it('handles non-Error video stream failures', async () => {
      mockStoreFunctions.getSyncedWorkflows.mockReturnValue([videoWorkflow]);
      async function* mockStream() {
        yield* [];
        throw 42;
      }
      streamVideoWorkflowSpy.mockReturnValue(mockStream());

      const { result } = renderHook(() => useWorkflowExecution());
      await act(async () => {
        await result.current.startAllSyncedVideoWorkflows();
      });

      expect(mockStoreFunctions.setWorkflowStatus).toHaveBeenCalledWith(
        'video-1',
        'failed',
        'Unknown error',
      );
    });
  });

  describe('retry and regenerate edge cases', () => {
    it('retries failed workflow when fresh workflow exists after clear', async () => {
      const failedWorkflow = {
        ...mockWorkflow,
        status: 'failed' as WorkflowStatus,
        messages: [
          { id: 'msg-1', role: 'user' as const, content: 'Retry me', createdAt: new Date() },
        ],
      };
      mockStoreFunctions.getWorkflow
        .mockReturnValueOnce(failedWorkflow)
        .mockReturnValueOnce({ ...mockWorkflow, messages: [] });

      async function* mockStream() {
        yield { type: 'complete' as const, workflowId: 'workflow-1' };
      }
      streamWorkflowSpy.mockReturnValue(mockStream());

      const { result } = renderHook(() => useWorkflowExecution());
      await act(async () => {
        await result.current.retryWorkflow('workflow-1');
      });

      expect(mockStoreFunctions.clearWorkflowHistory).toHaveBeenCalledWith('workflow-1');
      expect(mockStoreFunctions.addUserMessage).toHaveBeenCalledWith(
        'workflow-1',
        'Retry me',
        undefined,
      );
    });

    it('does not execute when fresh workflow is missing after regenerate', async () => {
      mockStoreFunctions.removeLastAssistantMessage.mockReturnValue('content');
      mockStoreFunctions.getWorkflow
        .mockReturnValueOnce(mockWorkflow)
        .mockReturnValueOnce(undefined);

      const { result } = renderHook(() => useWorkflowExecution());
      await act(async () => {
        await result.current.regenerateLastResponse('workflow-1');
      });

      expect(streamWorkflowSpy).not.toHaveBeenCalled();
    });
  });
});
