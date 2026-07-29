import 'dotenv/config';
import * as fs from 'node:fs';
import * as jwt from 'jsonwebtoken';
import dataSource from '../src/data-source';
import { User } from '../src/modules/users';

const SECRET = process.env.JWT_SECRET!;
const OUT_FILE = 'scripts/tokens.json';

async function mint() {
  if (!SECRET) throw new Error('JWT_SECRET is not set');

  await dataSource.initialize();
  const repo = dataSource.getRepository(User);

  // only the fields we need — no need to load password hashes etc.
  const users = await repo.find({ select: { id: true, role: true } });
  console.log(`Minting tokens for ${users.length} users...`);

  const tokens = users.map((u) => ({
    userId: u.id,
    role: u.role,
    token: jwt.sign(
      { sub: u.id, role: u.role }, // MUST match what your app expects
      SECRET,
      { expiresIn: '24h' }, // long, so tokens survive the whole test
    ),
  }));

  fs.writeFileSync(OUT_FILE, JSON.stringify(tokens, null, 2));
  console.log(`Wrote ${tokens.length} tokens to ${OUT_FILE}`);

  await dataSource.destroy();
}

mint().catch((err) => {
  console.error(err);
  process.exit(1);
});
