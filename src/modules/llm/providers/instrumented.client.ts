import type {
  LlmClient,
  LlmCompletion,
  LlmCompletionRequest,
} from '../llm-client';
import { LlmError } from '../llm.errors';
import type { MetricsService } from '../../metrics';

/** Records Prometheus metrics for every call made through `inner`. */
export class InstrumentedLlmClient implements LlmClient {
  constructor(
    private readonly inner: LlmClient,
    private readonly labels: { provider: string; model: string },
    private readonly metrics: MetricsService,
  ) {}

  async complete(request: LlmCompletionRequest): Promise<LlmCompletion> {
    const stopTimer = this.metrics.llmRequestDuration.startTimer(this.labels);
    try {
      const result = await this.inner.complete(request);
      this.metrics.llmRequests.inc({ ...this.labels, outcome: 'success' });
      if (result.usage) {
        this.metrics.llmTokens.inc(
          { direction: 'input' },
          result.usage.inputTokens,
        );
        this.metrics.llmTokens.inc(
          { direction: 'output' },
          result.usage.outputTokens,
        );
      }
      return result;
    } catch (err) {
      const outcome =
        err instanceof LlmError ? `${err.kind}_error` : 'unknown_error';
      this.metrics.llmRequests.inc({ ...this.labels, outcome });
      throw err;
    } finally {
      stopTimer();
    }
  }
}
