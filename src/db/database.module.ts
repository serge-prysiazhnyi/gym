import { Module } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export const DB_CLIENT = Symbol('DB_CLIENT');
export type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

@Module({
  providers: [
    {
      provide: DB_CLIENT,
      useFactory: () =>
        drizzle(
          new Pool({ connectionString: process.env.DATABASE_URL, max: 10 }),
          { schema },
        ),
    },
  ],
  exports: [DB_CLIENT],
})
export class DatabaseModule {}
