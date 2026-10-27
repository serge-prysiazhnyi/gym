import { Logger } from '@nestjs/common';
import type {
  LlmClient,
  LlmCompletion,
  LlmCompletionRequest,
} from '../llm-client';
import { LlmError } from '../llm.errors';

/**
 * Offline stand-in for a real provider. Keeps the old mock's 1.5–4s latency
 * and 10% failure rate, because load tests are calibrated against them.
 *
 * Understands "<n> sets of <reps> <exercise> [at <w> kg]" and replies with
 * the same JSON a real model would.
 */
export class MockLlmClient implements LlmClient {
  readonly provider = 'mock';
  readonly model = 'mock-regex';
  private readonly logger = new Logger(MockLlmClient.name);

  async complete(request: LlmCompletionRequest): Promise<LlmCompletion> {
    const delay = 1500 + Math.random() * 2500;
    await new Promise((resolve) => setTimeout(resolve, delay));

    if (Math.random() < 0.1) {
      throw new LlmError('LLM request failed (simulated)', 'transient', {
        provider: this.provider,
        model: this.model,
        status: 503,
      });
    }

    const log = request.messages[0]?.content ?? '';
    const rawText =
      /<workout_log>\n?([\s\S]*?)\n?<\/workout_log>/.exec(log)?.[1] ?? log;
    this.logger.debug(`Parsed in ${Math.round(delay)}ms: "${rawText}"`);

    const reply = this.parse(rawText, this.allowedNames(request));
    const text = JSON.stringify(reply);
    return {
      text,
      provider: this.provider,
      model: this.model,
      usage: {
        inputTokens: Math.ceil(request.system.length / 4),
        outputTokens: Math.ceil(text.length / 4),
        costUsd: 0,
      },
    };
  }

  private parse(rawText: string, allowed: string[]) {
    const match =
      /(\d+)\s*sets?\s*of\s*(\d+)\s*(.+?)(?:\s*at\s*(\d+(?:\.\d+)?)\s*kg)?$/i.exec(
        rawText.trim(),
      );

    if (!match) {
      return {
        status: 'not_a_workout',
        exercises: [],
        performedAt: null,
        durationMinutes: null,
      };
    }

    const [, setCount, reps, exerciseText, weight] = match;
    const originalText = rawText.trim();
    const name = allowed.find(
      (n) => n.toLowerCase() === exerciseText.trim().toLowerCase(),
    );

    return {
      status: 'ok',
      exercises: [
        name
          ? {
              type: 'strength',
              name,
              originalText,
              sets: Array.from({ length: Number(setCount) }, () => ({
                reps: Number(reps),
                weightKg: weight ? Number(weight) : null,
              })),
            }
          : { type: 'unknown', name: 'UNKNOWN', originalText },
      ],
      performedAt: null,
      durationMinutes: null,
    };
  }

  /**
   * Reads strength exercise names from the schema, like a structured-output
   * model would. The mock only understands reps × weight.
   */
  private allowedNames(request: LlmCompletionRequest): string[] {
    type Variant = {
      properties?: { type?: { const?: string }; name?: { enum?: string[] } };
    };
    const schema = request.jsonSchema?.schema as
      | { properties?: { exercises?: { items?: { anyOf?: Variant[] } } } }
      | undefined;
    const variants = schema?.properties?.exercises?.items?.anyOf ?? [];
    const strength = variants.find(
      (v) => v.properties?.type?.const === 'strength',
    );
    return strength?.properties?.name?.enum ?? [];
  }
}
