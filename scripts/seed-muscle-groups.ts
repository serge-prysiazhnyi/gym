import 'dotenv/config';
import dataSource from '../src/data-source';
import { MuscleGroup } from '../src/modules/muscle-groups/muscle-group.entity';

const MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Quadriceps',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Core',
];

async function seed() {
  await dataSource.initialize();
  const repo = dataSource.getRepository(MuscleGroup);

  for (const name of MUSCLE_GROUPS) {
    const existing = await repo.findOne({ where: { name } });
    if (existing) continue; // idempotent — safe to re-run
    await repo.save(repo.create({ name }));
    console.log(`  + ${name}`);
  }

  const total = await repo.count();
  console.log(`Muscle groups in database: ${total}`);
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
