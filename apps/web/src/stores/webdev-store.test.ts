import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SANDBOX_STATE } from '@/types/webdev';
import { createWebDevStore, webdevSelectors } from './webdev-store';

// Mock fetch using stubGlobal so the store module picks it up
const fetchMock = vi.fn<typeof fetch>();

describe('createWebDevStore', () => {
  let store: ReturnType<typeof createWebDevStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    store = createWebDevStore();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('initial state', () => {
    it('should have default state', () => {
      const state = store.getState();
      expect(state.sessionId).toBeNull();
      expect(state.phase).toBe('idle');
      expect(state.sandboxes.size).toBe(0);
      expect(state.activeWorkflowId).toBeNull();
      expect(state.featureConfig).toBeNull();
      expect(state.prompt).toBe('');
    });

    it('should accept initial state overrides', () => {
      const custom = createWebDevStore({ phase: 'generating', prompt: 'test' });
      expect(custom.getState().phase).toBe('generating');
      expect(custom.getState().prompt).toBe('test');
    });
  });

  describe('session management', () => {
    it('setSessionId should update sessionId', () => {
      store.getState().setSessionId('session-1');
      expect(store.getState().sessionId).toBe('session-1');
    });

    it('setSessionId should accept null', () => {
      store.getState().setSessionId('session-1');
      store.getState().setSessionId(null);
      expect(store.getState().sessionId).toBeNull();
    });

    it('setPhase should update phase', () => {
      store.getState().setPhase('generating');
      expect(store.getState().phase).toBe('generating');
    });

    it('resetSession should restore default state but preserve featureConfig', () => {
      const config = { enabled: true, provider: 'vercel-sandbox' as const };
      store.getState().setFeatureConfig(config);
      store.getState().setSessionId('session-1');
      store.getState().setPhase('ready');
      store.getState().setPrompt('hello');

      store.getState().resetSession();

      expect(store.getState().sessionId).toBeNull();
      expect(store.getState().phase).toBe('idle');
      expect(store.getState().prompt).toBe('');
      expect(store.getState().sandboxes.size).toBe(0);
      // Config should be preserved
      expect(store.getState().featureConfig).toEqual(config);
    });

    it('resetSession should fire-and-forget DELETE for active sandboxes', () => {
      store.getState().initSandbox('wf-1');
      store.getState().setSandboxReady('wf-1', 'sb-1', 'https://preview.test', null);

      store.getState().resetSession();

      expect(fetchMock).toHaveBeenCalledWith('/api/webdev/sandbox/sb-1', { method: 'DELETE' });
    });

    it('resetSession should not call DELETE when no sandboxes have sandboxId', () => {
      store.getState().initSandbox('wf-1');
      // sandboxId is null (default), so no delete

      store.getState().resetSession();

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('sandbox management', () => {
    it('initSandbox should create a new sandbox entry with default state', () => {
      store.getState().initSandbox('wf-1');
      const sandbox = store.getState().sandboxes.get('wf-1');
      expect(sandbox).toEqual(DEFAULT_SANDBOX_STATE);
    });

    it('initSandbox should not overwrite other sandboxes', () => {
      store.getState().initSandbox('wf-1');
      store.getState().initSandbox('wf-2');
      expect(store.getState().sandboxes.size).toBe(2);
      expect(store.getState().sandboxes.has('wf-1')).toBe(true);
      expect(store.getState().sandboxes.has('wf-2')).toBe(true);
    });

    it('updateSandboxStatus should update status of an existing sandbox', () => {
      store.getState().initSandbox('wf-1');
      store.getState().updateSandboxStatus('wf-1', 'creating');
      expect(store.getState().sandboxes.get('wf-1')?.status).toBe('creating');
    });

    it('updateSandboxStatus should set error when status is error', () => {
      store.getState().initSandbox('wf-1');
      store.getState().updateSandboxStatus('wf-1', 'error', 'Build failed');
      const sandbox = store.getState().sandboxes.get('wf-1');
      expect(sandbox?.status).toBe('error');
      expect(sandbox?.error).toBe('Build failed');
    });

    it('updateSandboxStatus should clear error when transitioning away from error', () => {
      store.getState().initSandbox('wf-1');
      store.getState().updateSandboxStatus('wf-1', 'error', 'Build failed');
      store.getState().updateSandboxStatus('wf-1', 'creating');
      expect(store.getState().sandboxes.get('wf-1')?.error).toBeNull();
    });

    it('updateSandboxStatus should no-op for non-existent sandbox', () => {
      const before = store.getState();
      store.getState().updateSandboxStatus('non-existent', 'creating');
      expect(store.getState().sandboxes).toBe(before.sandboxes);
    });

    it('setSandboxReady should update sandbox with ready state', () => {
      store.getState().initSandbox('wf-1');
      store.getState().setSandboxReady('wf-1', 'sb-1', 'https://preview.test', '2025-12-31');

      const sandbox = store.getState().sandboxes.get('wf-1');
      expect(sandbox?.status).toBe('ready');
      expect(sandbox?.sandboxId).toBe('sb-1');
      expect(sandbox?.previewUrl).toBe('https://preview.test');
      expect(sandbox?.expiresAt).toBe('2025-12-31');
      expect(sandbox?.error).toBeNull();
    });

    it('setSandboxReady should no-op for non-existent sandbox', () => {
      store.getState().setSandboxReady('non-existent', 'sb-1', 'url', null);
      expect(store.getState().sandboxes.size).toBe(0);
    });

    it('setSandboxFiles should set files and default activeFile', () => {
      store.getState().initSandbox('wf-1');
      store.getState().setSandboxFiles('wf-1', {
        'src/App.tsx': 'content1',
        'src/index.ts': 'content2',
      });

      const sandbox = store.getState().sandboxes.get('wf-1');
      expect(Object.keys(sandbox?.files ?? {})).toHaveLength(2);
      expect(sandbox?.activeFile).toBe('src/App.tsx');
    });

    it('setSandboxFiles should preserve existing activeFile', () => {
      store.getState().initSandbox('wf-1');
      store.getState().setActiveFile('wf-1', 'existing.ts');
      store.getState().setSandboxFiles('wf-1', { 'src/App.tsx': 'content' });

      expect(store.getState().sandboxes.get('wf-1')?.activeFile).toBe('existing.ts');
    });

    it('appendSandboxFile should add a single file', () => {
      store.getState().initSandbox('wf-1');
      store.getState().appendSandboxFile('wf-1', 'src/main.ts', 'hello');

      const sandbox = store.getState().sandboxes.get('wf-1');
      expect(sandbox?.files['src/main.ts']).toBe('hello');
      expect(sandbox?.activeFile).toBe('src/main.ts');
    });

    it('appendSandboxFile should not change activeFile if already set', () => {
      store.getState().initSandbox('wf-1');
      store.getState().appendSandboxFile('wf-1', 'first.ts', 'a');
      store.getState().appendSandboxFile('wf-1', 'second.ts', 'b');

      expect(store.getState().sandboxes.get('wf-1')?.activeFile).toBe('first.ts');
    });

    it('setActiveFile should update activeFile', () => {
      store.getState().initSandbox('wf-1');
      store.getState().setActiveFile('wf-1', 'new-file.ts');
      expect(store.getState().sandboxes.get('wf-1')?.activeFile).toBe('new-file.ts');
    });

    it('appendTerminalOutput should append line', () => {
      store.getState().initSandbox('wf-1');
      store.getState().appendTerminalOutput('wf-1', 'line 1');
      store.getState().appendTerminalOutput('wf-1', 'line 2');

      const output = store.getState().sandboxes.get('wf-1')?.terminalOutput;
      expect(output).toEqual(['line 1', 'line 2']);
    });
  });

  describe('destroySandbox', () => {
    it('should mark sandbox as stopped and call DELETE', async () => {
      store.getState().initSandbox('wf-1');
      store.getState().setSandboxReady('wf-1', 'sb-1', 'https://preview.test', null);

      await store.getState().destroySandbox('wf-1');

      const sandbox = store.getState().sandboxes.get('wf-1');
      expect(sandbox?.status).toBe('stopped');
      expect(sandbox?.sandboxId).toBeNull();
      expect(sandbox?.previewUrl).toBeNull();
      expect(fetchMock).toHaveBeenCalledWith('/api/webdev/sandbox/sb-1', { method: 'DELETE' });
    });

    it('should no-op when sandbox has no sandboxId', async () => {
      store.getState().initSandbox('wf-1');

      await store.getState().destroySandbox('wf-1');

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should no-op for non-existent workflowId', async () => {
      await store.getState().destroySandbox('non-existent');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should handle fetch failure gracefully', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));
      store.getState().initSandbox('wf-1');
      store.getState().setSandboxReady('wf-1', 'sb-1', 'url', null);

      // Should not throw
      await store.getState().destroySandbox('wf-1');
      expect(store.getState().sandboxes.get('wf-1')?.status).toBe('stopped');
    });
  });

  describe('destroyAllSandboxes', () => {
    it('should destroy all sandboxes', async () => {
      store.getState().initSandbox('wf-1');
      store.getState().setSandboxReady('wf-1', 'sb-1', 'url1', null);
      store.getState().initSandbox('wf-2');
      store.getState().setSandboxReady('wf-2', 'sb-2', 'url2', null);

      await store.getState().destroyAllSandboxes();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(store.getState().sandboxes.get('wf-1')?.status).toBe('stopped');
      expect(store.getState().sandboxes.get('wf-2')?.status).toBe('stopped');
    });
  });

  describe('active workflow', () => {
    it('setActiveWorkflowId should update activeWorkflowId', () => {
      store.getState().setActiveWorkflowId('wf-1');
      expect(store.getState().activeWorkflowId).toBe('wf-1');
    });

    it('setActiveWorkflowId should accept null', () => {
      store.getState().setActiveWorkflowId('wf-1');
      store.getState().setActiveWorkflowId(null);
      expect(store.getState().activeWorkflowId).toBeNull();
    });
  });

  describe('feature config', () => {
    it('setFeatureConfig should update featureConfig', () => {
      const config = { enabled: true, provider: 'vercel-sandbox' as const };
      store.getState().setFeatureConfig(config);
      expect(store.getState().featureConfig).toEqual(config);
    });

    it('checkConfig should fetch and set config on success', async () => {
      const mockConfig = { enabled: true, provider: 'vercel-sandbox' };
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(mockConfig), { status: 200 }));

      await store.getState().checkConfig();

      expect(fetchMock).toHaveBeenCalledWith('/api/webdev/config');
      expect(store.getState().featureConfig).toEqual(mockConfig);
    });

    it('checkConfig should set disabled config on non-ok response', async () => {
      fetchMock.mockResolvedValueOnce(new Response('', { status: 500 }));

      await store.getState().checkConfig();

      expect(store.getState().featureConfig).toEqual({
        enabled: false,
        provider: 'disabled',
        reason: 'VERCEL_SANDBOX_NOT_CONFIGURED',
      });
    });

    it('checkConfig should set disabled config on fetch error', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      await store.getState().checkConfig();

      expect(store.getState().featureConfig).toEqual({
        enabled: false,
        provider: 'disabled',
        reason: 'VERCEL_SANDBOX_NOT_CONFIGURED',
      });
    });
  });

  describe('prompt', () => {
    it('setPrompt should update prompt', () => {
      store.getState().setPrompt('Build a todo app');
      expect(store.getState().prompt).toBe('Build a todo app');
    });

    it('setSubmittedPrompt should update submittedPrompt', () => {
      store.getState().setSubmittedPrompt('submitted');
      expect(store.getState().submittedPrompt).toBe('submitted');
    });
  });

  describe('conversation and snapshot helpers', () => {
    it('setConversationId should update conversationId', () => {
      store.getState().setConversationId('conv-1');
      expect(store.getState().conversationId).toBe('conv-1');
      store.getState().setConversationId(null);
      expect(store.getState().conversationId).toBeNull();
    });

    it('setSnapshotId should update sandbox snapshotId or no-op', () => {
      store.getState().setSnapshotId('missing', 'snap-1');
      expect(store.getState().sandboxes.size).toBe(0);

      store.getState().initSandbox('wf-1');
      store.getState().setSnapshotId('wf-1', 'snap-1');
      expect(store.getState().sandboxes.get('wf-1')?.snapshotId).toBe('snap-1');
    });

    it('no-ops file/terminal helpers for missing sandboxes', () => {
      const before = store.getState().sandboxes;
      store.getState().setSandboxFiles('missing', { a: '1' });
      store.getState().appendSandboxFile('missing', 'a', '1');
      store.getState().setActiveFile('missing', 'a');
      store.getState().appendTerminalOutput('missing', 'line');
      expect(store.getState().sandboxes).toBe(before);
    });

    it('setSandboxFiles uses null activeFile when files object is empty', () => {
      store.getState().initSandbox('wf-1');
      store.getState().setSandboxFiles('wf-1', {});
      expect(store.getState().sandboxes.get('wf-1')?.activeFile).toBeNull();
    });

    it('updateSandboxStatus keeps prior error when status is error without message', () => {
      store.getState().initSandbox('wf-1');
      store.getState().updateSandboxStatus('wf-1', 'error', 'first');
      store.getState().updateSandboxStatus('wf-1', 'error');
      expect(store.getState().sandboxes.get('wf-1')?.error).toBe('first');
    });

    it('isAnyBuildingOrReady includes snapshotting and restoring', () => {
      store.getState().initSandbox('wf-1');
      store.getState().updateSandboxStatus('wf-1', 'snapshotting');
      expect(store.getState().isAnyBuildingOrReady()).toBe(true);

      store.getState().updateSandboxStatus('wf-1', 'restoring');
      expect(store.getState().isAnyBuildingOrReady()).toBe(true);
    });
  });

  describe('iteration management', () => {
    it('addIteration and getActiveIteration work together', () => {
      const iteration = {
        id: 'it-1',
        version: 1,
        prompt: 'v1',
        sandboxes: new Map(),
        responseMap: new Map([['wf-1', 'hello']]),
      };
      store.getState().addIteration(iteration);
      store.getState().setActiveIterationVersion(1);
      expect(store.getState().iterations).toHaveLength(1);
      expect(store.getState().getActiveIteration()).toEqual(iteration);
      store.getState().setActiveIterationVersion(99);
      expect(store.getState().getActiveIteration()).toBeUndefined();
    });

    it('snapshotCurrentIteration captures sandbox snapshots and response map', () => {
      store.getState().initSandbox('wf-1');
      store.getState().setSandboxReady('wf-1', 'sb-1', 'https://p', 'exp');
      store.getState().setSandboxFiles('wf-1', { 'App.tsx': 'code' });
      store.getState().setSnapshotId('wf-1', 'snap-x');

      store
        .getState()
        .snapshotCurrentIteration('it-2', 2, 'iterate', new Map([['wf-1', 'response text']]));

      const snap = store.getState().iterations[0];
      expect(snap).toBeDefined();
      if (!snap) throw new Error('expected snapshot');
      expect(snap.id).toBe('it-2');
      expect(snap.version).toBe(2);
      expect(snap.prompt).toBe('iterate');
      expect(snap.responseMap.get('wf-1')).toBe('response text');
      expect(snap.sandboxes.get('wf-1')).toEqual({
        files: { 'App.tsx': 'code' },
        sandboxId: 'sb-1',
        snapshotId: 'snap-x',
        previewUrl: 'https://p',
        expiresAt: 'exp',
      });
    });
  });

  describe('selector methods', () => {
    it('getSandbox should return sandbox by workflowId', () => {
      store.getState().initSandbox('wf-1');
      expect(store.getState().getSandbox('wf-1')).toEqual(DEFAULT_SANDBOX_STATE);
    });

    it('getSandbox should return undefined for non-existent workflowId', () => {
      expect(store.getState().getSandbox('non-existent')).toBeUndefined();
    });

    it('getActiveSandbox should return sandbox for activeWorkflowId', () => {
      store.getState().initSandbox('wf-1');
      store.getState().setActiveWorkflowId('wf-1');
      expect(store.getState().getActiveSandbox()).toEqual(DEFAULT_SANDBOX_STATE);
    });

    it('getActiveSandbox should return undefined when no activeWorkflowId', () => {
      expect(store.getState().getActiveSandbox()).toBeUndefined();
    });

    it('isAnyBuildingOrReady should return true if any sandbox is creating/installing/starting/ready', () => {
      store.getState().initSandbox('wf-1');
      store.getState().updateSandboxStatus('wf-1', 'creating');
      expect(store.getState().isAnyBuildingOrReady()).toBe(true);

      store.getState().updateSandboxStatus('wf-1', 'installing');
      expect(store.getState().isAnyBuildingOrReady()).toBe(true);

      store.getState().updateSandboxStatus('wf-1', 'starting');
      expect(store.getState().isAnyBuildingOrReady()).toBe(true);

      store.getState().updateSandboxStatus('wf-1', 'ready');
      expect(store.getState().isAnyBuildingOrReady()).toBe(true);
    });

    it('isAnyBuildingOrReady should return false when all sandboxes are idle/error/stopped', () => {
      store.getState().initSandbox('wf-1');
      expect(store.getState().isAnyBuildingOrReady()).toBe(false);

      store.getState().updateSandboxStatus('wf-1', 'error');
      expect(store.getState().isAnyBuildingOrReady()).toBe(false);

      store.getState().updateSandboxStatus('wf-1', 'stopped');
      expect(store.getState().isAnyBuildingOrReady()).toBe(false);
    });

    it('isAnyBuildingOrReady should return false when no sandboxes', () => {
      expect(store.getState().isAnyBuildingOrReady()).toBe(false);
    });
  });
});

describe('webdevSelectors', () => {
  let store: ReturnType<typeof createWebDevStore>;

  beforeEach(() => {
    store = createWebDevStore();
  });

  it('phase should return current phase', () => {
    expect(webdevSelectors.phase(store.getState())).toBe('idle');
  });

  it('sessionId should return current sessionId', () => {
    expect(webdevSelectors.sessionId(store.getState())).toBeNull();
  });

  it('prompt should return current prompt', () => {
    expect(webdevSelectors.prompt(store.getState())).toBe('');
  });

  it('isEnabled should return false when featureConfig is null', () => {
    expect(webdevSelectors.isEnabled(store.getState())).toBe(false);
  });

  it('isEnabled should return true when config enabled', () => {
    store.getState().setFeatureConfig({ enabled: true, provider: 'vercel-sandbox' });
    expect(webdevSelectors.isEnabled(store.getState())).toBe(true);
  });

  it('activeSandbox should return sandbox for activeWorkflowId', () => {
    store.getState().initSandbox('wf-1');
    store.getState().setActiveWorkflowId('wf-1');
    expect(webdevSelectors.activeSandbox(store.getState())).toEqual(DEFAULT_SANDBOX_STATE);
  });

  it('activeSandbox should return undefined when no activeWorkflowId', () => {
    expect(webdevSelectors.activeSandbox(store.getState())).toBeUndefined();
  });

  it('sandboxCount should return number of sandboxes', () => {
    expect(webdevSelectors.sandboxCount(store.getState())).toBe(0);
    store.getState().initSandbox('wf-1');
    store.getState().initSandbox('wf-2');
    expect(webdevSelectors.sandboxCount(store.getState())).toBe(2);
  });

  it('readySandboxCount should count only ready sandboxes', () => {
    store.getState().initSandbox('wf-1');
    store.getState().initSandbox('wf-2');
    store.getState().initSandbox('wf-3');
    store.getState().setSandboxReady('wf-1', 'sb-1', 'url1', null);
    store.getState().updateSandboxStatus('wf-2', 'error');

    expect(webdevSelectors.readySandboxCount(store.getState())).toBe(1);
  });

  it('isAnyBuilding should detect creating/installing/starting statuses', () => {
    store.getState().initSandbox('wf-1');
    expect(webdevSelectors.isAnyBuilding(store.getState())).toBe(false);

    store.getState().updateSandboxStatus('wf-1', 'creating');
    expect(webdevSelectors.isAnyBuilding(store.getState())).toBe(true);
  });

  it('isAnyBuilding should not count ready as building', () => {
    store.getState().initSandbox('wf-1');
    store.getState().setSandboxReady('wf-1', 'sb-1', 'url', null);
    expect(webdevSelectors.isAnyBuilding(store.getState())).toBe(false);
  });

  it('webdevState should return composite state', () => {
    const state = webdevSelectors.webdevState(store.getState());
    expect(state).toHaveProperty('phase');
    expect(state).toHaveProperty('sessionId');
    expect(state).toHaveProperty('prompt');
    expect(state).toHaveProperty('sandboxes');
    expect(state).toHaveProperty('activeWorkflowId');
    expect(state).toHaveProperty('featureConfig');
  });

  it('webdevActions should return all action functions', () => {
    const actions = webdevSelectors.webdevActions(store.getState());
    expect(typeof actions.setSessionId).toBe('function');
    expect(typeof actions.resetSession).toBe('function');
    expect(typeof actions.initSandbox).toBe('function');
    expect(typeof actions.destroySandbox).toBe('function');
    expect(typeof actions.checkConfig).toBe('function');
    expect(typeof actions.setConversationId).toBe('function');
    expect(typeof actions.setSubmittedPrompt).toBe('function');
    expect(typeof actions.addIteration).toBe('function');
    expect(typeof actions.snapshotCurrentIteration).toBe('function');
  });

  it('conversationId and iterations selectors expose state', () => {
    store.getState().setConversationId('c1');
    store.getState().addIteration({
      id: 'i1',
      version: 1,
      prompt: 'p',
      sandboxes: new Map(),
      responseMap: new Map(),
    });
    expect(webdevSelectors.conversationId(store.getState())).toBe('c1');
    expect(webdevSelectors.iterations(store.getState())).toHaveLength(1);
    expect(webdevSelectors.activeIterationVersion(store.getState())).toBe(0);
  });

  it('isLatestIteration is true for version 0, empty iterations, or ahead of max', () => {
    expect(webdevSelectors.isLatestIteration(store.getState())).toBe(true);

    store.getState().addIteration({
      id: 'i1',
      version: 2,
      prompt: 'p',
      sandboxes: new Map(),
      responseMap: new Map(),
    });
    store.getState().setActiveIterationVersion(1);
    expect(webdevSelectors.isLatestIteration(store.getState())).toBe(false);

    store.getState().setActiveIterationVersion(3);
    expect(webdevSelectors.isLatestIteration(store.getState())).toBe(true);

    store.getState().setActiveIterationVersion(0);
    expect(webdevSelectors.isLatestIteration(store.getState())).toBe(true);
  });

  it('isAnyBuilding includes snapshotting and restoring', () => {
    store.getState().initSandbox('wf-1');
    store.getState().updateSandboxStatus('wf-1', 'snapshotting');
    expect(webdevSelectors.isAnyBuilding(store.getState())).toBe(true);
    store.getState().updateSandboxStatus('wf-1', 'restoring');
    expect(webdevSelectors.isAnyBuilding(store.getState())).toBe(true);
  });

  it('webdevState includes submittedPrompt and iteration fields', () => {
    store.getState().setSubmittedPrompt('done');
    store.getState().setActiveIterationVersion(4);
    const state = webdevSelectors.webdevState(store.getState());
    expect(state.submittedPrompt).toBe('done');
    expect(state.activeIterationVersion).toBe(4);
    expect(state.iterations).toEqual([]);
  });
});
