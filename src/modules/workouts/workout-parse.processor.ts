import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { UnrecoverableError } from 'bullmq';

import { BadRequestException, Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { WORKOUT_PARSE_QUEUE } from '../queue/';
import { LLM_SERVICE, LlmError, LlmOutputError } from '../llm';
import type { LlmService, ParseOutcome, ParsedExercise } from '../llm';
import { ExercisesService } from '../exercises';
import type { CatalogueEntry } from '../exercises';
import { WorkoutsService } from './workouts.service';
import { CreateWorkoutSetDto } from './dto/workout.dto';
import { ParseJobError } from './parse-errors';

interface ParseJobData {
  userId: string;
  rawText: string;
  idempotencyKey: string;
}

// Each job holds an LLM call for seconds, so concurrency is bounded by what
// the provider tolerates, not by CPU. Per process; the app runs 2 of them.
const CONCURRENCY_NUMBER = 20;
// Queue-wide (shared through Redis), so it holds across all processes.
const RATE_LIMIT = { max: 20, duration: 1000 };

// Clock skew allowance before a parsed date counts as "in the future".
const FUTURE_TOLERANCE_MS = 24 * 60 * 60 * 1000;

/**
 * Maps parsed sets to the DTO for their workout type. The `never` check makes
 * a newly registered set type fail to compile here until it is handled.
 */
function toWorkoutSets(
  exercise: ParsedExercise,
  exerciseId: string,
): CreateWorkoutSetDto[] {
  switch (exercise.type) {
    case 'strength':
      return exercise.sets.map((s, i) => ({
        exerciseId,
        setNumber: i + 1,
        reps: s.reps,
        weightKg: s.weightKg ?? undefined,
      }));
    default: {
      const unhandled: never = exercise.type;
      throw new ParseJobError('PARSE_FAILED', {
        reason: `unsupported set type ${String(unhandled)}`,
      });
    }
  }
}

@Processor(WORKOUT_PARSE_QUEUE, {
  concurrency: CONCURRENCY_NUMBER,
  limiter: RATE_LIMIT,
})
export class WorkoutParseProcessor extends WorkerHost {
  private readonly logger = new Logger(WorkoutParseProcessor.name);

  constructor(
    @Inject(LLM_SERVICE) private readonly llm: LlmService,
    private readonly workouts: WorkoutsService,
    private readonly exercises: ExercisesService,
  ) {
    super();
  }

  async process(job: Job<ParseJobData>): Promise<{ workoutId: string }> {
    const { userId, rawText, idempotencyKey } = job.data;
    this.logger.log(`Parsing job ${job.id}`);

    const existing = await this.workouts.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      this.logger.log(`Job ${job.id}: already processed, skipping`);
      return { workoutId: existing.id };
    }

    const catalogue = await this.exercises.getCatalogue();
    const outcome = await this.parse(rawText, catalogue);

    if (outcome.kind === 'rejected') {
      throw outcome.reason === 'not_a_workout'
        ? new ParseJobError('NOT_A_WORKOUT')
        : new ParseJobError('UNRECOGNIZED_EXERCISES', {
            unrecognized: outcome.unrecognized ?? [],
          });
    }
    const parsed = outcome.workout;

    const idsByName = new Map(catalogue.map((e) => [e.name, e.id]));
    const sets: CreateWorkoutSetDto[] = [];
    for (const e of parsed.exercises) {
      const exerciseId = idsByName.get(e.name);
      // Can't happen while the catalogue is the same one the model saw.
      if (!exerciseId) throw new ParseJobError('PARSE_FAILED');

      sets.push(...toWorkoutSets(e, exerciseId));
    }

    const workout = await this.save(userId, idempotencyKey, {
      rawText,
      sets,
      performedAt: this.pastDateOrUndefined(parsed.performedAt),
      durationSeconds: parsed.durationMinutes
        ? parsed.durationMinutes * 60
        : undefined,
    });
    this.logger.log(`Job ${job.id}: ✨ created workout ✨ ${workout.id}`);

    return { workoutId: workout.id };
  }

  /**
   * Calls the LLM and decides what is worth retrying. Transient provider
   * errors are rethrown as-is so BullMQ retries with backoff; everything
   * else fails the job at once with a user-safe code.
   */
  private async parse(
    rawText: string,
    catalogue: CatalogueEntry[],
  ): Promise<ParseOutcome> {
    try {
      return await this.llm.parseWorkout(rawText, {
        // Exercises have no type column yet, so every entry is strength.
        catalogue: catalogue.map((e) => ({
          name: e.name,
          setType: 'strength' as const,
        })),
        now: new Date(),
      });
    } catch (err) {
      if (err instanceof LlmOutputError) {
        throw new ParseJobError('PARSE_FAILED');
      }
      if (err instanceof LlmError && err.kind === 'permanent') {
        this.logger.error(`LLM permanent error: ${err.message}`);
        throw new ParseJobError('LLM_UNAVAILABLE');
      }
      throw err;
    }
  }

  /** Saves the workout; a validation rejection won't change on retry. */
  private async save(
    userId: string,
    idempotencyKey: string,
    dto: Parameters<WorkoutsService['create']>[1],
  ) {
    try {
      return await this.workouts.create(userId, dto, idempotencyKey);
    } catch (err) {
      if (err instanceof BadRequestException) {
        throw new ParseJobError('PARSE_FAILED');
      }
      throw err;
    }
  }

  /** A model can misread "Friday" as next Friday; fall back to now. */
  private pastDateOrUndefined(iso: string | null): string | undefined {
    if (!iso) return undefined;
    return Date.parse(iso) <= Date.now() + FUTURE_TOLERANCE_MS
      ? iso
      : undefined;
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ParseJobData>, err: Error) {
    const isFinal =
      err instanceof UnrecoverableError ||
      job.attemptsMade >= (job.opts.attempts ?? 1);

    this.logger.warn(
      `❌ Job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts.attempts})` +
        `${isFinal ? ' — GIVING UP' : ' — will retry'}: ${err.message}\n` +
        `  rawText: "${job.data.rawText}"`,
    );
  }
}
