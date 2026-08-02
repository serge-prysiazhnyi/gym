import 'dotenv/config';
import dataSource from '../src/data-source';
import { User } from '../src/modules/users';
import { Exercise } from '../src/modules/exercises';
import { Workout, WorkoutSet } from '../src/modules/workouts';

const WORKOUTS_PER_USER = 100; // ~1 year of training
const SETS_PER_WORKOUT = 20; // 5 exercises × 4 sets
const BATCH_SIZE = 2000; // rows per insert statement

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function seed() {
  await dataSource.initialize();

  const users = await dataSource.getRepository(User).find({
    where: { role: 'user' },
    select: { id: true },
  });

  console.log('users loaded:', users.length);
  console.log('first user:', users[0]);
  console.log('last user:', users[users.length - 1]);

  const exercises = await dataSource.getRepository(Exercise).find({
    select: { id: true },
  });

  if (!users.length || !exercises.length) {
    throw new Error('Seed users and exercises first.');
  }

  const totalWorkouts = users.length * WORKOUTS_PER_USER;
  console.log(
    `Seeding ${totalWorkouts.toLocaleString()} workouts, ` +
      `~${(totalWorkouts * SETS_PER_WORKOUT).toLocaleString()} sets...`,
  );

  const start = Date.now();
  let workoutBuffer: any[] = [];
  let setBuffer: any[] = [];
  let done = 0;

  for (const user of users) {
    for (let w = 0; w < WORKOUTS_PER_USER; w++) {
      const workoutId = crypto.randomUUID();

      // spread workouts over the past ~2 years
      const daysAgo = randomInt(0, 730);
      const performedAt = new Date(Date.now() - daysAgo * 86_400_000);

      workoutBuffer.push({
        id: workoutId,
        userId: user.id,
        performedAt: performedAt,
        durationSeconds: randomInt(1800, 5400),
        rawText: null,
        createdAt: performedAt,
      });

      // 5 random exercises, 4 sets each
      for (let e = 0; e < 5; e++) {
        const exercise = exercises[randomInt(0, exercises.length - 1)];
        for (let s = 1; s <= 4; s++) {
          setBuffer.push({
            id: crypto.randomUUID(),
            workoutId: workoutId,
            exerciseId: exercise.id,
            setNumber: s,
            reps: randomInt(5, 15),
            weightKg: randomInt(20, 140),
          });
        }
      }

      if (workoutBuffer.length >= BATCH_SIZE) {
        await flush(workoutBuffer, setBuffer);
        done += workoutBuffer.length;
        console.log(
          `  ${done.toLocaleString()}/${totalWorkouts.toLocaleString()}`,
        );
        workoutBuffer = [];
        setBuffer = [];
      }
    }
  }

  if (workoutBuffer.length) await flush(workoutBuffer, setBuffer);

  console.log(`Done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  await dataSource.destroy();
}

async function flush(workouts: any[], sets: any[]) {
  await dataSource.transaction(async (manager) => {
    await manager
      .createQueryBuilder()
      .insert()
      .into(Workout)
      .values(workouts)
      .execute();

    // sets are chunked further — Postgres has a parameter limit per statement
    for (let i = 0; i < sets.length; i += 5000) {
      await manager
        .createQueryBuilder()
        .insert()
        .into(WorkoutSet)
        .values(sets.slice(i, i + 5000))
        .execute();
    }
  });
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
