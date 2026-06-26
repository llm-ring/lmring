import { createOpenRouter as createOpenRouterProvider } from '@openrouter/ai-sdk-provider';
import type { ProviderInstance } from '../types/provider';

type CreateOpenRouter = typeof createOpenRouterProvider;
type OpenRouterProviderV4 = Omit<ReturnType<CreateOpenRouter>, 'languageModel' | 'chat'> & {
  languageModel: ProviderInstance['languageModel'];
  chat: ProviderInstance['languageModel'];
};

/**
 * Compatibility shim for `@openrouter/ai-sdk-provider`.
 *
 * The OpenRouter provider (v2.x) still implements the `LanguageModelV3`
 * specification, while AI SDK v7 / `@ai-sdk/provider` v4 expects providers to
 * return `LanguageModelV4`. The two specs are structurally identical apart from
 * the `specificationVersion` string (`'v3'` vs `'v4'`), and AI SDK v7's
 * `streamText`/`generateText` still accept V3 models at runtime — so the
 * mismatch is purely at the type level.
 *
 * This cast bridges that gap until OpenRouter ships a v7-native release. Once
 * `@openrouter/ai-sdk-provider` returns `LanguageModelV4`, drop this shim and
 * use `createOpenRouter` directly again.
 */
export const createOpenRouter = createOpenRouterProvider as unknown as (
  ...args: Parameters<CreateOpenRouter>
) => OpenRouterProviderV4;
