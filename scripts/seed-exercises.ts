import 'dotenv/config';
import dataSource from '../src/data-source';
import { Exercise } from '../src/modules/exercises/exercise.entity';
import { MuscleGroup } from '../src/modules/muscle-groups/muscle-group.entity';

/** Exercise name → the muscle groups it targets. */
const EXERCISES: Record<string, string[]> = {
  'Push-Ups': ['Chest', 'Triceps', 'Shoulders', 'Core'],
  Squat: ['Quadriceps', 'Glutes', 'Hamstrings', 'Core'],
  'Glute Bridge': ['Glutes', 'Hamstrings'],
  'Cable Lat Pulldown': ['Back', 'Biceps'],
  'Pull-Ups': ['Back', 'Biceps', 'Core'],
  'Assisted Pull-Ups': ['Back', 'Biceps'],
  'Seated Cable Row': ['Back', 'Biceps'],
  Plank: ['Core', 'Shoulders'],
  'Tricep Pushdown': ['Triceps'],
  'Preacher Curl': ['Biceps'],
  'Bicep Curl': ['Biceps'],
  'Dumbbell Incline Press': ['Chest', 'Shoulders', 'Triceps'],
  'Dumbbell Overhead Press': ['Shoulders', 'Triceps', 'Core'],
  'Barbell Curl': ['Biceps'],
  'Leg Curl': ['Hamstrings'],
  'Romanian Deadlift': ['Hamstrings', 'Glutes', 'Back'],
  'Hanging Knee Raise': ['Core'],
};

async function seed() {
  await dataSource.initialize();
  const exerciseRepo = dataSource.getRepository(Exercise);
  const groupRepo = dataSource.getRepository(MuscleGroup);

  // Load all muscle groups once, into a lookup map — avoids querying per exercise
  const allGroups = await groupRepo.find();
  const groupsByName = new Map(allGroups.map((g) => [g.name, g]));

  if (allGroups.length === 0) {
    throw new Error('No muscle groups found. Run seed-muscle-groups first.');
  }

  for (const [name, groupNames] of Object.entries(EXERCISES)) {
    // Case-insensitive existence check, matching the unique index
    const existing = await exerciseRepo
      .createQueryBuilder('e')
      .where('LOWER(e.name) = LOWER(:name)', { name })
      .getOne();

    if (existing) {
      console.log(`  = ${name} (exists)`);
      continue;
    }

    const groups = groupNames.map((gn) => {
      const g = groupsByName.get(gn);
      if (!g) throw new Error(`Unknown muscle group "${gn}" for "${name}"`);
      return g;
    });

    await exerciseRepo.save(
      exerciseRepo.create({ name, muscleGroups: groups }),
    );
    console.log(`  + ${name} → ${groupNames.join(', ')}`);
  }

  const total = await exerciseRepo.count();
  console.log(`Exercises in database: ${total}`);
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
