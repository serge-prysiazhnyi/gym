import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { UnrecoverableError } from 'bullmq';

import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { WORKOUT_PARSE_QUEUE } from '../queue/';
import { LLM_SERVICE } from '../llm';
import type { LlmService } from '../llm';
import { ExercisesService } from '../exercises';
import { WorkoutsService } from './workouts.service';
import { CreateWorkoutSetDto } from './dto/workout.dto';

interface ParseJobData {
  userId: string;
  rawText: string;
  idempotencyKey: string;
}

const CONCURRENCY_NUMBER = 50;

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

    const parsed = await this.llm.parseWorkout(rawText);

    // Resolve names → ids
    const sets: CreateWorkoutSetDto[] = [];
    for (const s of parsed.sets) {
      const exercise = await this.exercises.findByName(s.exerciseName);

      if (!exercise) {
        throw new UnrecoverableError(`Unknown exercise: "${s.exerciseName}"`);
      }

      sets.push({
        exerciseId: exercise.id,
        setNumber: s.setNumber,
        reps: s.reps,
        weightKg: s.weightKg ?? undefined,
      });
    }

    const workout = await this.workouts.create(
      userId,
      { rawText, sets },
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
