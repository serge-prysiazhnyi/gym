export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LlmJsonSchema {
  name: string;
  schema: Record<string, unknown>;
}

export interface LlmCompletionRequest {
  system: string;
  messages: LlmMessage[];
  /** Clients that support structured output send it; others ignore it. */
  jsonSchema?: LlmJsonSchema;
  maxOutputTokens: number;
  temperature: number;
  signal?: AbortSignal;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  /** Only some providers (e.g. OpenRouter) report cost. */
  costUsd?: number;
}

export interface LlmCompletion {
  text: string;
  provider: string;
  model: string;
  usage?: LlmUsage;
}

/**
 * Low-level, provider-agnostic text completion port.
 *
 * Implementations must throw `LlmError` so callers can tell retryable
 * failures from permanent ones without knowing the provider.
 */
export interface LlmClient {
  complete(request: LlmCompletionRequest): Promise<LlmCompletion>;
}

export const LLM_CLIENT = Symbol('LLM_CLIENT');
