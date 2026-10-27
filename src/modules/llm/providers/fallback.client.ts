import type {
  LlmClient,
  LlmCompletion,
  LlmCompletionRequest,
} from '../llm-client';
import { LlmError } from '../llm.errors';

/**
 * Tries the primary model, and on one *transient* failure retries once on
 * the fallback model. Permanent errors (bad key, bad request) would fail on
 * the fallback too, so they are rethrown as-is.
 */
export class FallbackLlmClient implements LlmClient {
  constructor(
    private readonly primary: LlmClient,
    private readonly fallback: LlmClient,
  ) {}

  async complete(request: LlmCompletionRequest): Promise<LlmCompletion> {
    try {
      return await this.primary.complete(request);
    } catch (err) {
      // The caller's timeout covers both attempts; once it has fired the
      // fallback would abort immediately, so don't bother.
      if (
        !(err instanceof LlmError) ||
        err.kind !== 'transient' ||
        request.signal?.aborted
      ) {
        throw err;
      }
      return this.fallback.complete(request);
    }
  }
}
