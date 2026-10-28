import { BadRequestException } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import { LlmError, LlmOutputError } from '../llm';
import type { LlmService, ParseOutcome } from '../llm';
import type { ExercisesService } from '../exercises';
import type { WorkoutsService } from './workouts.service';
import { WorkoutParseProcessor } from './workout-parse.processor';
import { ParseJobError } from './parse-errors';

const SQUAT_ID = '11111111-1111-4111-8111-111111111111';
const BENCH_ID = '22222222-2222-4222-8222-222222222222';

const job = {
  id: 'job-1',
  data: { userId: 'user-1', rawText: 'squat 3x5 100kg', idempotencyKey: 'k1' },
  attemptsMade: 0,
  opts: { attempts: 3 },
} as unknown as Job<{
  userId: string;
  rawText: string;
  idempotencyKey: string;
}>;

const okOutcome: ParseOutcome = {
  kind: 'ok',
  workout: {
    exercises: [
      {
        type: 'strength',
        name: 'Squat',
        originalText: 'squat 3x5 100kg',
        sets: [
          { reps: 5, weightKg: 100 },
          { reps: 5, weightKg: 100 },
        ],
      },
      {
        type: 'strength',
        name: 'Bench Press',
        originalText: 'bench 8',
        sets: [{ reps: 8, weightKg: null }],
      },
    ],
    performedAt: null,
    durationMinutes: 45,
  },
};

function setup(parse: () => Promise<ParseOutcome>) {
  const parseWorkout = jest.fn(parse);
  const llm: LlmService = { parseWorkout };
  const create = jest
    .fn<Promise<{ id: string }>, [string, Record<string, unknown>, string]>()
    .mockResolvedValue({ id: 'workout-1' });
  const findByIdempotencyKey = jest
    .fn<Promise<{ id: string } | null>, [string]>()
    .mockResolvedValue(null);
  const workouts = {
    findByIdempotencyKey,
    create,
  } as unknown as WorkoutsService;
  const exercises = {
    getCatalogue: jest.fn().mockResolvedValue([
      { id: SQUAT_ID, name: 'Squat' },
      { id: BENCH_ID, name: 'Bench Press' },
    ]),
  } as unknown as ExercisesService;

  const processor = new WorkoutParseProcessor(llm, workouts, exercises);
  return { processor, parseWorkout, create, findByIdempotencyKey };
}

/** Runs the job and returns the error it failed with. */
async function failure(processor: WorkoutParseProcessor): Promise<unknown> {
  return processor.process(job).then(
    () => {
      throw new Error('Expected the job to fail');
    },
    (err: unknown) => err,
  );
}

describe('WorkoutParseProcessor', () => {
  it('saves the workout with catalogue ids and per-exercise set numbers', async () => {
    const { processor, parseWorkout, create } = setup(() =>
      Promise.resolve(okOutcome),
    );

    await expect(processor.process(job)).resolves.toEqual({
      workoutId: 'workout-1',
    });

    expect(parseWorkout).toHaveBeenCalledWith('squat 3x5 100kg', {
      catalogue: [
        { name: 'Squat', setType: 'strength' },
        { name: 'Bench Press', setType: 'strength' },
      ],
      now: expect.any(Date) as unknown,
    });
    expect(create).toHaveBeenCalledWith(
      'user-1',
      {
        rawText: 'squat 3x5 100kg',
        performedAt: undefined,
        durationSeconds: 2700,
        sets: [
          { exerciseId: SQUAT_ID, setNumber: 1, reps: 5, weightKg: 100 },
          { exerciseId: SQUAT_ID, setNumber: 2, reps: 5, weightKg: 100 },
          { exerciseId: BENCH_ID, setNumber: 1, reps: 8, weightKg: undefined },
        ],
      },
      'k1',
    );
  });

  it('drops a performedAt that lies in the future', async () => {
    const future = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const past = '2026-10-20T18:00:00.000Z';

    for (const [performedAt, expected] of [
      [future, undefined],
      [past, past],
    ]) {
      const { processor, create } = setup(() =>
        Promise.resolve({
          kind: 'ok',
          workout: { ...okOutcome.workout, performedAt },
        } as ParseOutcome),
      );
      await processor.process(job);
      expect(create.mock.calls[0][1]).toMatchObject({ performedAt: expected });
    }
  });

  it.each<[string, () => Promise<ParseOutcome>, string, unknown]>([
    [
      'not_a_workout',
      () => Promise.resolve({ kind: 'rejected', reason: 'not_a_workout' }),
      'NOT_A_WORKOUT',
      undefined,
    ],
    [
      'unrecognized exercises',
      () =>
        Promise.resolve({
          kind: 'rejected',
          reason: 'unrecognized_exercises',
          unrecognized: ['zercher 5x5'],
        }),
      'UNRECOGNIZED_EXERCISES',
      { unrecognized: ['zercher 5x5'] },
    ],
    [
      'invalid model output',
      () => Promise.reject(new LlmOutputError('bad', 'issues')),
      'PARSE_FAILED',
      undefined,
    ],
    [
      'permanent provider error',
      () =>
        Promise.reject(
          new LlmError('HTTP 401', 'permanent', {
            provider: 'p',
            model: 'm',
            status: 401,
          }),
        ),
      'LLM_UNAVAILABLE',
      undefined,
    ],
  ])('%s → unrecoverable %s', async (_, parse, code, details) => {
    const { processor, create } = setup(parse);

    const err = await failure(processor);

    expect(err).toBeInstanceOf(UnrecoverableError);
    expect(err).toBeInstanceOf(ParseJobError);
    expect(err).toMatchObject({ code, message: code, details });
    expect(create).not.toHaveBeenCalled();
  });

  it('rethrows transient provider errors so BullMQ retries', async () => {
    const transient = new LlmError('HTTP 503', 'transient', {
      provider: 'p',
      model: 'm',
      status: 503,
    });
    const { processor } = setup(() => Promise.reject(transient));

    const err = await failure(processor);

    expect(err).toBe(transient);
    expect(err).not.toBeInstanceOf(UnrecoverableError);
  });

  it('maps a validation rejection on save to PARSE_FAILED', async () => {
    const { processor, create } = setup(() => Promise.resolve(okOutcome));
    create.mockRejectedValue(new BadRequestException('invalid'));

    await expect(failure(processor)).resolves.toMatchObject({
      code: 'PARSE_FAILED',
    });
  });

  it('lets other save errors (e.g. DB down) be retried', async () => {
    const { processor, create } = setup(() => Promise.resolve(okOutcome));
    const dbError = new Error('connection terminated');
    create.mockRejectedValue(dbError);

    await expect(failure(processor)).resolves.toBe(dbError);
  });

  it('skips the LLM when the job was already processed', async () => {
    const { processor, parseWorkout, findByIdempotencyKey } = setup(() =>
      Promise.resolve(okOutcome),
    );
    findByIdempotencyKey.mockResolvedValue({ id: 'existing' });

    await expect(processor.process(job)).resolves.toEqual({
      workoutId: 'existing',
    });
    expect(parseWorkout).not.toHaveBeenCalled();
  });
});
