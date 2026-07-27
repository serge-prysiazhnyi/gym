import 'dotenv/config';
import * as argon2 from 'argon2';
import { faker } from '@faker-js/faker';
import dataSource from '../src/data-source';
import { User } from '../src/modules/users/user.entity';

const TOTAL = 5000; // how many users to create
const BATCH = 500; // insert in chunks, not all at once

async function seed() {
  await dataSource.initialize();
  const repo = dataSource.getRepository(User);

  // One shared hash for all seeded users — see note below on why.
  const sharedHash = await argon2.hash('password123');

  console.log(`Seeding ${TOTAL} users...`);
  const start = Date.now();

  for (let offset = 0; offset < TOTAL; offset += BATCH) {
    const batch: Partial<User>[] = [];

    for (let i = 0; i < BATCH && offset + i < TOTAL; i++) {
      batch.push({
        email: faker.internet.email({ provider: `seed${offset + i}.test` }),
        name: faker.person.fullName(),
        role: 'user',
        passwordHash: sharedHash,
      });
    }

    await repo.insert(batch); // bulk insert — one query per batch
    console.log(`  inserted ${Math.min(offset + BATCH, TOTAL)}/${TOTAL}`);
  }

  console.log(`Done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
