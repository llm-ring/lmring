import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  let workflowCounter = 0;
  return {
    createWorkflow: vi.fn(() => {
      workflowCounter += 1;
      return `wf-${workflowCounter}`;
    }),
    updateWorkflow: vi.fn(),
    setWorkflowConfig: vi.fn(),
    setGlobalPrompt: vi.fn(),
    resetConversation: vi.fn(),
    setActiveWorkflowId: vi.fn(),
    setPhase: vi.fn(),
    initSandbox: vi.fn(),
    snapshotCurrentIteration: vi.fn(),
    startAllSyncedWorkflows: vi.fn().mockResolvedValue(undefined),
    continueAllSyncedWorkflows: vi.fn().mockResolvedValue(undefined),
    sessionId: 'session-1' as string | null,
    resetCounter() {
      workflowCounter = 0;
    },
  };
});

vi.mock('@/stores/workflow-store', () => ({
  useWorkflowStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      createWorkflow: mocks.createWorkflow,
      updateWorkflow: mocks.updateWorkflow,
      setWorkflowConfig: mocks.setWorkflowConfig,
      setGlobalPrompt: mocks.setGlobalPrompt,
      resetConversation: mocks.resetConversation,
    }),
}));

vi.mock('@/stores/webdev-store', () => ({
  useWebDevStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      setActiveWorkflowId: mocks.setActiveWorkflowId,
      setPhase: mocks.setPhase,
      initSandbox: mocks.initSandbox,
      snapshotCurrentIteration: mocks.snapshotCurrentIteration,
      sessionId: mocks.sessionId,
    }),
}));

vi.mock('./use-workflow-execution', () => ({
  useWorkflowExecution: () => ({
    startAllSyncedWorkflows: mocks.startAllSyncedWorkflows,
    continueAllSyncedWorkflows: mocks.continueAllSyncedWorkflows,
  }),
}));

vi.mock('@/constants/webdev', () => ({
  WEBDEV_SYSTEM_PROMPT: 'system prompt',
  WEBDEV_WORKFLOW_CONFIG: { temperature: 0.2 },
}));

import { useWebDevGeneration } from './use-webdev-generation';

describe('useWebDevGeneration', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mocks.resetCounter();
    vi.clearAllMocks();
    mocks.sessionId = 'session-1';
    mocks.startAllSyncedWorkflows.mockResolvedValue(undefined);
    mocks.continueAllSyncedWorkflows.mockResolvedValue(undefined);
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('startGeneration creates workflows, maps responses, and starts streaming', async () => {
    const { result } = renderHook(() => useWebDevGeneration());

    await act(async () => {
      await result.current.startGeneration({
        prompt: 'Build a todo app',
        models: [
          { modelId: 'gpt-4', keyId: 'k1' },
          { modelId: 'claude', keyId: 'k2' },
        ],
        sessionResponses: [
          { id: 'r1', modelId: 'gpt-4', displayPosition: 0 },
          { id: 'r2', modelId: 'claude', displayPosition: 1 },
        ],
        iteration: { id: 'i1', version: 1 },
      });
    });

    expect(mocks.resetConversation).toHaveBeenCalled();
    expect(mocks.createWorkflow).toHaveBeenCalledTimes(2);
    expect(mocks.updateWorkflow).toHaveBeenCalledTimes(2);
    expect(mocks.setWorkflowConfig).toHaveBeenCalledWith('wf-1', { temperature: 0.2 });
    expect(mocks.setActiveWorkflowId).toHaveBeenCalledWith('wf-1');
    expect(mocks.setGlobalPrompt).toHaveBeenCalledWith('Build a todo app');
    expect(mocks.startAllSyncedWorkflows).toHaveBeenCalled();
    expect(result.current.getResponseId('wf-1')).toBe('r1');
    expect(result.current.getResponseId('wf-2')).toBe('r2');
  });

  it('handleFollowUp no-ops for empty prompt or missing session', async () => {
    const { result } = renderHook(() => useWebDevGeneration());

    await act(async () => {
      await result.current.handleFollowUp('   ');
    });
    expect(fetchSpy).not.toHaveBeenCalled();

    mocks.sessionId = null;
    // re-render to pick up new sessionId via selector — store mock reads mocks.sessionId live
    const { result: result2 } = renderHook(() => useWebDevGeneration());
    await act(async () => {
      await result2.current.handleFollowUp('Improve UI');
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('handleFollowUp sets error phase when API fails', async () => {
    const { result } = renderHook(() => useWebDevGeneration());

    // seed response map via startGeneration
    await act(async () => {
      await result.current.startGeneration({
        prompt: 'App',
        models: [{ modelId: 'gpt-4', keyId: 'k1' }],
        sessionResponses: [{ id: 'r1', modelId: 'gpt-4', displayPosition: 0 }],
        iteration: { id: 'i1', version: 1 },
      });
    });

    fetchSpy.mockResolvedValueOnce({ ok: false } as Response);

    await act(async () => {
      await result.current.handleFollowUp('Improve UI');
    });

    expect(mocks.snapshotCurrentIteration).toHaveBeenCalled();
    expect(mocks.setPhase).toHaveBeenCalledWith('error');
    expect(mocks.continueAllSyncedWorkflows).not.toHaveBeenCalled();
  });

  it('handleFollowUp creates new iteration and continues workflows', async () => {
    const { result } = renderHook(() => useWebDevGeneration());

    await act(async () => {
      await result.current.startGeneration({
        prompt: 'App',
        models: [
          { modelId: 'gpt-4', keyId: 'k1' },
          { modelId: 'claude', keyId: 'k2' },
        ],
        sessionResponses: [
          { id: 'r1', modelId: 'gpt-4', displayPosition: 0 },
          { id: 'r2', modelId: 'claude', displayPosition: 1 },
        ],
        iteration: { id: 'i1', version: 1 },
      });
    });

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        iteration: { id: 'i2', version: 2, prompt: 'Improve UI' },
        responses: [
          { id: 'r3', modelId: 'gpt-4', displayPosition: 0 },
          { id: 'r4', modelId: 'claude', displayPosition: 1 },
        ],
      }),
    } as Response);

    await act(async () => {
      await result.current.handleFollowUp('Improve UI');
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/webdev/session',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ sessionId: 'session-1', prompt: 'Improve UI' }),
      }),
    );
    expect(mocks.initSandbox).toHaveBeenCalledWith('wf-1');
    expect(mocks.initSandbox).toHaveBeenCalledWith('wf-2');
    expect(mocks.setPhase).toHaveBeenCalledWith('generating');
    expect(mocks.continueAllSyncedWorkflows).toHaveBeenCalledWith('Improve UI');
    expect(result.current.getResponseId('wf-1')).toBe('r3');
    expect(result.current.getResponseId('wf-2')).toBe('r4');
  });
});
