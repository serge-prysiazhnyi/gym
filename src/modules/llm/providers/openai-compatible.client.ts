import OpenAI, {
  APIConnectionError,
  APIError,
  APIUserAbortError,
} from 'openai';
import type {
  LlmClient,
  LlmCompletion,
  LlmCompletionRequest,
} from '../llm-client';
import { LlmError } from '../llm.errors';

export interface OpenAiCompatibleConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  structuredOutput: boolean;
}

/** OpenRouter adds `cost` (USD) to the standard usage block. */
function readCostUsd(usage: OpenAI.CompletionUsage): number | undefined {
  const cost: unknown = (usage as unknown as Record<string, unknown>).cost;
  return typeof cost === 'number' ? cost : undefined;
}

/**
 * Any provider that speaks the OpenAI chat-completions API: OpenRouter,
 * OpenAI, Groq, DeepSeek, Ollama… Switching is a `baseURL` + `model` change.
 */
export class OpenAiCompatibleClient implements LlmClient {
  private readonly client: OpenAI;
  readonly provider: string;
  readonly model: string;

  constructor(private readonly config: OpenAiCompatibleConfig) {
    // Retries belong to BullMQ and FallbackLlmClient; SDK retries would hide
    // failures from metrics and stretch the timeout budget.
    this.client = new OpenAI({
      baseURL: config.baseURL,
      apiKey: config.apiKey,
      maxRetries: 0,
    });
    this.provider = new URL(config.baseURL).hostname;
    this.model = config.model;
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletion> {
    let response: OpenAI.ChatCompletion;
    try {
      response = await this.client.chat.completions.create(
        {
          model: this.model,
          messages: [
            { role: 'system', content: request.system },
            ...request.messages,
          ],
          temperature: request.temperature,
          max_tokens: request.maxOutputTokens,
          ...(this.config.structuredOutput && request.jsonSchema
            ? {
                response_format: {
                  type: 'json_schema',
                  json_schema: {
                    name: request.jsonSchema.name,
                    schema: request.jsonSchema.schema,
                    strict: true,
                  },
                },
              }
            : {}),
        },
        { signal: request.signal },
      );
    } catch (err) {
      throw this.toLlmError(err);
    }

    const text = response.choices?.[0]?.message?.content;
    if (typeof text !== 'string') {
      // Seen with overloaded upstreams behind routers: 200 with no choices.
      throw new LlmError('Provider returned no content', 'transient', {
        provider: this.provider,
        model: this.model,
      });
    }

    const usage = response.usage;
    return {
      text,
      provider: this.provider,
      model: response.model || this.model,
      usage: usage && {
        inputTokens: usage.prompt_tokens,
        outputTokens: usage.completion_tokens,
        costUsd: readCostUsd(usage),
      },
    };
  }

  /** Maps SDK errors to transient/permanent without leaking provider bodies. */
  toLlmError(err: unknown): LlmError {
    const details = { provider: this.provider, model: this.model };

    // Covers both connection timeouts and our own AbortSignal.timeout.
    if (err instanceof APIUserAbortError || err instanceof APIConnectionError) {
      return new LlmError(
        'LLM request timed out or could not connect',
        'transient',
        details,
        { cause: err },
      );
    }

    if (err instanceof APIError && typeof err.status === 'number') {
      const status = err.status;
      const transient = status === 408 || status === 429 || status >= 500;
      return new LlmError(
        `LLM provider responded with HTTP ${status}`,
        transient ? 'transient' : 'permanent',
        { ...details, status },
        { cause: err },
      );
    }

    // Unknown failures (DNS, socket resets surfacing as plain errors) are
    // usually environmental, so give them another chance.
    return new LlmError('LLM request failed', 'transient', details, {
      cause: err,
    });
  }
}
