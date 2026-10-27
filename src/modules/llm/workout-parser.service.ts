import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

import { LLM_CLIENT } from './llm-client';
import type { LlmClient, LlmMessage } from './llm-client';
import { LlmOutputError } from './llm.errors';
import type {
  LlmService,
  ParseOutcome,
  ParsedExercise,
  ParseWorkoutOptions,
} from './llm.service';
import { getSetType } from './set-types';
import {
  buildParseWorkoutSystemPrompt,
  buildRepairMessage,
  wrapWorkoutLog,
} from './prompts/parse-workout.prompt';
import {
  UNKNOWN_TYPE,
  buildWorkoutParseSchema,
  toProviderJsonSchema,
} from './workout-parse.schema';
import type {
  WorkoutParseReply,
  WorkoutParseSchema,
} from './workout-parse.schema';

// Keeps the repair turn small if the model rambled.
const MAX_ECHOED_REPLY_CHARS = 4000;

type Attempt =
  { ok: true; value: WorkoutParseReply } | { ok: false; issues: string };

@Injectable()
export class LlmWorkoutParser implements LlmService {
  private readonly logger = new Logger(LlmWorkoutParser.name);
  private readonly timeoutMs: number;
  private readonly maxOutputTokens: number;

  constructor(
    @Inject(LLM_CLIENT) private readonly client: LlmClient,
    config: ConfigService,
  ) {
    this.timeoutMs = config.get<number>('LLM_TIMEOUT_MS', 20000);
    this.maxOutputTokens = config.get<number>('LLM_MAX_OUTPUT_TOKENS', 1500);
  }

  /**
   * Turns free text into a workout restricted to the catalogue.
   *
   * An invalid reply gets exactly one repair turn with the validation errors;
   * after that `LlmOutputError` is thrown. Provider failures (`LlmError`) are
   * not repaired here — whether to retry is the caller's call.
   */
  async parseWorkout(
    rawText: string,
    { catalogue, now }: ParseWorkoutOptions,
  ): Promise<ParseOutcome> {
    const schema = buildWorkoutParseSchema(catalogue);
    const system = buildParseWorkoutSystemPrompt({ catalogue, now });
    const jsonSchema = {
      name: 'workout_log',
      schema: toProviderJsonSchema(schema),
    };
    const messages: LlmMessage[] = [
      { role: 'user', content: wrapWorkoutLog(rawText) },
    ];

    let reply = await this.complete(system, messages, jsonSchema);
    let attempt = this.validate(reply, schema);

    if (!attempt.ok) {
      this.logger.debug(`Invalid reply, repairing: ${attempt.issues}`);
      messages.push(
        { role: 'assistant', content: reply.slice(0, MAX_ECHOED_REPLY_CHARS) },
        { role: 'user', content: buildRepairMessage(attempt.issues) },
      );
      reply = await this.complete(system, messages, jsonSchema);
      attempt = this.validate(reply, schema);
    }

    if (!attempt.ok) {
      throw new LlmOutputError(
        'LLM reply failed validation after repair',
        attempt.issues,
      );
    }

    return this.toOutcome(attempt.value);
  }

  private async complete(
    system: string,
    messages: LlmMessage[],
    jsonSchema: { name: string; schema: Record<string, unknown> },
  ): Promise<string> {
    const { text } = await this.client.complete({
      system,
      messages,
      jsonSchema,
      maxOutputTokens: this.maxOutputTokens,
      temperature: 0,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    return text;
  }

  private validate(text: string, schema: WorkoutParseSchema): Attempt {
    let json: unknown;
    try {
      json = JSON.parse(extractJson(text));
    } catch {
      return { ok: false, issues: 'Reply is not valid JSON.' };
    }

    const result = schema.safeParse(json);
    return result.success
      ? { ok: true, value: result.data }
      : { ok: false, issues: z.prettifyError(result.error) };
  }

  private toOutcome(reply: WorkoutParseReply): ParseOutcome {
    if (reply.status === 'not_a_workout') {
      return { kind: 'rejected', reason: 'not_a_workout' };
    }

    const known: ParsedExercise[] = [];
    const unrecognized: string[] = [];
    for (const e of reply.exercises) {
      if (e.type === UNKNOWN_TYPE) {
        unrecognized.push(e.originalText);
        continue;
      }
      const setType = getSetType(e.type);
      // The schema built this variant from `setType`, so the pairing of
      // `type` and set shape is already validated; TS just can't see it.
      known.push({
        type: e.type,
        name: e.name,
        originalText: e.originalText,
        sets: e.sets.map((set) => setType.normalizeSet(set as never)),
      });
    }

    if (unrecognized.length > 0) {
      return {
        kind: 'rejected',
        reason: 'unrecognized_exercises',
        unrecognized,
      };
    }

    return {
      kind: 'ok',
      workout: {
        exercises: known,
        performedAt: reply.performedAt,
        durationMinutes: reply.durationMinutes,
      },
    };
  }
}

/** Models often wrap JSON in ``` fences or add a sentence around it. */
export function extractJson(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  return start !== -1 && end > start ? body.slice(start, end + 1) : body;
}
