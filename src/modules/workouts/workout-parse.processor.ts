import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { UnrecoverableError } from 'bullmq';

import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { WORKOUT_PARSE_QUEUE } from '../queue/';
import { LLM_SERVICE } from '../llm';
import type { LlmService, ParsedExercise } from '../llm';
import { ExercisesService } from '../exercises';
import { WorkoutsService } from './workouts.service';
import { CreateWorkoutSetDto } from './dto/workout.dto';

interface ParseJobData {
  userId: string;
  rawText: string;
  idempotencyKey: string;
}

const CONCURRENCY_NUMBER = 125;

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
      throw new UnrecoverableError(
        `Unsupported set type: ${String(unhandled)}`,
      );
    }
  }
}

@Processor(WORKOUT_PARSE_QUEUE, { concurrency: CONCURRENCY_NUMBER })
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

    // The catalogue constrains the model's output to exercises we can save.
    // Exercises have no type column yet, so every entry is strength.
    const catalogue = await this.exercises.findAll(1, 1000);
    const outcome = await this.llm.parseWorkout(rawText, {
      catalogue: catalogue.data.map((e) => ({
        name: e.name,
        setType: 'strength' as const,
      })),
      now: new Date(),
    });

    if (outcome.kind === 'rejected') {
      throw new UnrecoverableError(`Parse rejected: ${outcome.reason}`);
    }
    const parsed = outcome.workout;

    // Resolve names → ids
    const sets: CreateWorkoutSetDto[] = [];
    for (const e of parsed.exercises) {
      const exercise = await this.exercises.findByName(e.name);

      if (!exercise) {
        throw new UnrecoverableError(`Unknown exercise: "${e.name}"`);
      }

      sets.push(...toWorkoutSets(e, exercise.id));
    }

    const workout = await this.workouts.create(
      userId,
      {
        rawText,
        sets,
        performedAt: parsed.performedAt ?? undefined,
        durationSeconds: parsed.durationMinutes
          ? parsed.durationMinutes * 60
          : undefined,
      },
      idempotencyKey,
    );
    this.logger.log(`Job ${job.id}: ✨ created workout ✨ ${workout.id}`);

    return { workoutId: workout.id };
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ParseJobData>, err: Error) {
    const isFinal = job.attemptsMade >= (job.opts.attempts ?? 1);

    this.logger.warn(
      `❌ Job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts.attempts})` +
        `${isFinal ? ' — GIVING UP' : ' — will retry'}: ${err.message}\n` +
        `  rawText: "${job.data.rawText}"`,
    );
  }
}
