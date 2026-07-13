import type { ChatModelCard, ImageModelCard } from '../types';

const giteeaiChatModels: ChatModelCard[] = [
  {
    id: 'code-raccoon-v1',
    displayName: 'Code Raccoon V1',
    description: '代码小浣熊软件研发助手，支持需求分析、架构设计、编码与测试。',
    type: 'chat',
    enabled: true,
  },
  {
    id: 'Qwen2.5-72B-Instruct',
    displayName: 'Qwen2.5 72B Instruct',
    description:
      'Qwen2.5-72B-Instruct 是通义千问团队开发的大规模语言模型，拥有卓越的语言理解和生成能力。',
    type: 'chat',
    contextWindowTokens: 131_072,
    enabled: true,
    abilities: { functionCall: true },
  },
  {
    id: 'Qwen2.5-32B-Instruct',
    displayName: 'Qwen2.5 32B Instruct',
    description: 'Qwen2.5 32B Instruct 是一款性能优异的中等规模指令遵循模型。',
    type: 'chat',
    contextWindowTokens: 32_768,
    enabled: true,
  },
  {
    id: 'Qwen2.5-14B-Instruct',
    displayName: 'Qwen2.5 14B Instruct',
    description: 'Qwen2.5 14B Instruct 适用于多种日常任务场景。',
    type: 'chat',
    contextWindowTokens: 32_768,
    enabled: true,
  },
  {
    id: 'Qwen2.5-7B-Instruct',
    displayName: 'Qwen2.5 7B Instruct',
    description: 'Qwen2.5 7B Instruct 是一款轻量高效的语言模型。',
    type: 'chat',
    contextWindowTokens: 131_072,
    enabled: true,
    abilities: { functionCall: true },
  },
  {
    id: 'DeepSeek-R1',
    displayName: 'DeepSeek R1',
    description: 'DeepSeek R1 是 DeepSeek 推出的具备深度推理能力的先进模型。',
    type: 'chat',
    contextWindowTokens: 131_072,
    enabled: true,
    abilities: { reasoning: true },
  },
  {
    id: 'DeepSeek-V3',
    displayName: 'DeepSeek V3',
    description: 'DeepSeek V3 是 DeepSeek 开发的高性能通用语言模型。',
    type: 'chat',
    contextWindowTokens: 65_536,
    enabled: true,
  },
  {
    id: 'Llama-3.1-70B-Instruct',
    displayName: 'Llama 3.1 70B Instruct',
    description: 'Llama 3.1 70B Instruct 是 Meta 开发的大规模开源语言模型。',
    type: 'chat',
    contextWindowTokens: 32_768,
  },
  {
    id: 'Llama-3.1-8B-Instruct',
    displayName: 'Llama 3.1 8B Instruct',
    description: 'Llama 3.1 8B Instruct 是一款轻量级的指令遵循模型。',
    type: 'chat',
    contextWindowTokens: 128_000,
  },
  {
    id: 'glm-4-9b-chat',
    displayName: 'GLM-4 9B Chat',
    description: 'GLM-4-9B-Chat 是智谱 AI 开发的开源对话模型。',
    type: 'chat',
    contextWindowTokens: 32_768,
    enabled: true,
    abilities: { functionCall: true },
  },
  {
    id: 'DeepSeek-R1-Distill-Qwen-1.5B',
    displayName: 'DeepSeek R1 Distill Qwen 1.5B',
    description: 'A DeepSeek-R1 distilled model based on Qwen2.5-Math-1.5B.',
    type: 'chat',
    contextWindowTokens: 32_000,
    enabled: true,
    abilities: { reasoning: true },
  },
  {
    id: 'DeepSeek-R1-Distill-Qwen-7B',
    displayName: 'DeepSeek R1 Distill Qwen 7B',
    description: 'A DeepSeek-R1 distilled model based on Qwen2.5-Math-7B.',
    type: 'chat',
    contextWindowTokens: 32_000,
    enabled: true,
    abilities: { reasoning: true },
  },
  {
    id: 'DeepSeek-R1-Distill-Qwen-14B',
    displayName: 'DeepSeek R1 Distill Qwen 14B',
    description: 'A DeepSeek-R1 distilled model based on Qwen2.5-14B.',
    type: 'chat',
    contextWindowTokens: 32_000,
    enabled: true,
    abilities: { reasoning: true },
  },
  {
    id: 'DeepSeek-R1-Distill-Qwen-32B',
    displayName: 'DeepSeek R1 Distill Qwen 32B',
    description:
      'The DeepSeek-R1 series improves reasoning performance with reinforcement learning and cold-start data, setting new multi-task benchmarks for open models and surpassing OpenAI o1-mini.',
    type: 'chat',
    contextWindowTokens: 32_000,
    enabled: true,
    abilities: { reasoning: true },
  },
  {
    id: 'QwQ-32B-Preview',
    displayName: 'QwQ 32B Preview',
    description:
      'QwQ-32B-Preview is an innovative NLP model that efficiently handles complex dialogue generation and context understanding.',
    type: 'chat',
    contextWindowTokens: 32_000,
    enabled: true,
    abilities: { reasoning: true },
  },
  {
    id: 'Qwen2-72B-Instruct',
    displayName: 'Qwen2 72B Instruct',
    description: 'Qwen2 is the latest Qwen series, supporting a 128k context window.',
    type: 'chat',
    contextWindowTokens: 32_000,
  },
  {
    id: 'Qwen2-7B-Instruct',
    displayName: 'Qwen2 7B Instruct',
    description:
      'Qwen2 is the latest Qwen series, surpassing the best open models of similar size and even larger models.',
    type: 'chat',
    contextWindowTokens: 24_000,
  },
  {
    id: 'Qwen2.5-Coder-32B-Instruct',
    displayName: 'Qwen2.5 Coder 32B Instruct',
    description:
      'Qwen2.5-Coder-32B-Instruct is an LLM designed for code generation, code understanding, and efficient development workflows.',
    type: 'chat',
    contextWindowTokens: 32_000,
    enabled: true,
  },
  {
    id: 'Qwen2.5-Coder-14B-Instruct',
    displayName: 'Qwen2.5 Coder 14B Instruct',
    description:
      'Qwen2.5-Coder-14B-Instruct is a large-scale pre-trained coding instruction model with strong code understanding and generation.',
    type: 'chat',
    contextWindowTokens: 24_000,
    enabled: true,
  },
  {
    id: 'Qwen2-VL-72B',
    displayName: 'Qwen2 VL 72B',
    description:
      'Qwen2-VL-72B is a powerful vision-language model supporting multimodal image-text processing, accurately recognizing image content and generating relevant descriptions or answers.',
    type: 'chat',
    contextWindowTokens: 32_000,
    enabled: true,
    abilities: { vision: true },
  },
  {
    id: 'InternVL2.5-26B',
    displayName: 'InternVL2.5 26B',
    description:
      'InternVL2.5-26B is a powerful vision-language model supporting multimodal image-text processing, accurately recognizing image content and generating relevant descriptions or answers.',
    type: 'chat',
    contextWindowTokens: 32_000,
    enabled: true,
    abilities: { vision: true },
  },
  {
    id: 'InternVL2-8B',
    displayName: 'InternVL2 8B',
    description:
      'InternVL2-8B is a powerful vision-language model supporting multimodal image-text processing, accurately recognizing image content and generating relevant descriptions or answers.',
    type: 'chat',
    contextWindowTokens: 32_000,
    enabled: true,
    abilities: { vision: true },
  },
  {
    id: 'Yi-34B-Chat',
    displayName: 'Yi 34B Chat',
    description:
      'Yi-1.5-34B retains the series’ strong general language abilities while using incremental training on 500B high-quality tokens to significantly improve math logic and coding.',
    type: 'chat',
    contextWindowTokens: 4_000,
    enabled: true,
  },
  {
    id: 'deepseek-coder-33B-instruct',
    displayName: 'DeepSeek Coder 33B Instruct',
    description:
      'DeepSeek Coder 33B is a code language model trained on 2T tokens (87% code, 13% Chinese/English text).',
    type: 'chat',
    contextWindowTokens: 8_000,
    enabled: true,
  },
  {
    id: 'codegeex4-all-9b',
    displayName: 'CodeGeeX4 All 9B',
    description:
      'CodeGeeX4-ALL-9B is a multilingual code generation model supporting code completion and generation, code interpreter, web search, function calling, and repo-level code Q&A, covering a wide range of software development scenarios.',
    type: 'chat',
    contextWindowTokens: 32_000,
    enabled: true,
  },
];

const giteeaiImageModels: ImageModelCard[] = [
  {
    id: 'FLUX.1-dev',
    displayName: 'FLUX.1-dev',
    description:
      'FLUX.1-dev is an open-source multimodal language model (MLLM) from Black Forest Labs, optimized for image-text tasks and combining image/text understanding and generation.',
    type: 'image',
    enabled: true,
  },
  {
    id: 'flux-1-schnell',
    displayName: 'flux-1-schnell',
    description:
      'A 12B-parameter text-to-image model from Black Forest Labs using latent adversarial diffusion distillation to generate high-quality images in 1-4 steps.',
    type: 'image',
    enabled: true,
  },
  {
    id: 'FLUX.1-Kontext-dev',
    displayName: 'FLUX.1-Kontext-dev',
    description:
      'FLUX.1-Kontext-dev is a multimodal image generation and editing model from Black Forest Labs based on a Rectified Flow Transformer architecture with 12B parameters.',
    type: 'image',
    enabled: true,
  },
  {
    id: 'stable-diffusion-3.5-large-turbo',
    displayName: 'stable-diffusion-3.5-large-turbo',
    description:
      'Stable Diffusion 3.5 Large Turbo focuses on high-quality image generation with strong detail rendering and scene fidelity.',
    type: 'image',
    enabled: true,
  },
  {
    id: 'stable-diffusion-3-medium',
    displayName: 'stable-diffusion-3-medium',
    description: 'The latest text-to-image model from Stability AI.',
    type: 'image',
    enabled: true,
  },
  {
    id: 'stable-diffusion-xl-base-1.0',
    displayName: 'stable-diffusion-xl-base-1.0',
    description:
      'An open-source text-to-image model from Stability AI with industry-leading creative image generation.',
    type: 'image',
    enabled: true,
  },
  {
    id: 'Kolors',
    displayName: 'Kolors',
    description: 'Kolors is a text-to-image model developed by the Kuaishou Kolors team.',
    type: 'image',
    enabled: true,
  },
  {
    id: 'HunyuanDiT-v1.2-Diffusers-Distilled',
    displayName: 'HunyuanDiT-v1.2-Diffusers-Distilled',
    description:
      'hunyuandit-v1.2-distilled is a lightweight text-to-image model optimized via distillation to generate high-quality images quickly, especially suited for low-resource environments and real-time generation.',
    type: 'image',
    enabled: true,
  },
  {
    id: 'HiDream-I1-Full',
    displayName: 'HiDream-I1-Full',
    description: 'HiDream-I1 is a new open-source base image generation model released by HiDream.',
    type: 'image',
    enabled: true,
  },
  {
    id: 'HiDream-E1-Full',
    displayName: 'HiDream-E1-Full',
    description:
      'HiDream-E1-Full is an open-source multimodal image editing model from HiDream.ai, based on an advanced Diffusion Transformer architecture and strong language understanding (built-in LLaMA 3.1-8B-Instruct).',
    type: 'image',
    enabled: true,
  },
  {
    id: 'HelloMeme',
    displayName: 'HelloMeme',
    description:
      'HelloMeme is an AI tool that generates memes, GIFs, or short videos from the images or motions you provide.',
    type: 'image',
    enabled: true,
  },
  {
    id: 'OmniConsistency',
    displayName: 'OmniConsistency',
    description:
      'OmniConsistency improves style consistency and generalization in image-to-image tasks by introducing large-scale Diffusion Transformers (DiTs) and paired stylized data, avoiding style degradation.',
    type: 'image',
    enabled: true,
  },
  {
    id: 'InstantCharacter',
    displayName: 'InstantCharacter',
    description:
      'InstantCharacter is a tuning-free personalized character generation model released by Tencent AI in 2025, aiming for high-fidelity, cross-scenario consistent character generation.',
    type: 'image',
    enabled: true,
  },
  {
    id: 'DreamO',
    displayName: 'DreamO',
    description:
      'DreamO is an open-source image customization model jointly developed by ByteDance and Peking University, using a unified architecture to support multi-task image generation.',
    type: 'image',
    enabled: true,
  },
  {
    id: 'AnimeSharp',
    displayName: 'AnimeSharp',
    description:
      'AnimeSharp (aka "4x-AnimeSharp") is an open-source super-resolution model based on ESRGAN by Kim2091, focused on upscaling and sharpening anime-style images.',
    type: 'image',
    enabled: true,
  },
];

export default {
  chat: giteeaiChatModels,
  image: giteeaiImageModels,
};
