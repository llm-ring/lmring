import type { LanguageModelV4Middleware } from '@ai-sdk/provider';

export interface PluginContext {
  providerId: string;
  modelId: string;
  method: string;
  attempt: number;
  metadata: Record<string, unknown>;
}

export abstract class AiPlugin {
  abstract name: string;
  description?: string;
  enforce?: 'pre' | 'post';

  async onInit(_context: PluginContext): Promise<void> {
    // Optional initialization
  }

  async transformParams(params: unknown, _context: PluginContext): Promise<unknown> {
    return params;
  }

  async transformResult(result: unknown, _context: PluginContext): Promise<unknown> {
    return result;
  }

  async onRequestStart(_context: PluginContext): Promise<void> {
    // Optional hook
  }

  async onRequestEnd(_context: PluginContext, _result: unknown): Promise<void> {
    // Optional hook
  }

  async onError(_error: Error, _context: PluginContext): Promise<void> {
    // Optional hook
  }

  async onStream(chunk: unknown, _context: PluginContext): Promise<unknown> {
    return chunk;
  }

  toMiddleware(): LanguageModelV4Middleware | null {
    return null;
  }
}
