import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB_CLIENT, type DrizzleDb } from '../../db/database.module';
import { users, type User } from '../../db/schema';
import type { UsersRepository } from './users.repository';

@Injectable()
export class DrizzleUsersRepository implements UsersRepository {
  constructor(@Inject(DB_CLIENT) private readonly db: DrizzleDb) {}

  async findById(id: string): Promise<User | null> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id));

    return row ?? null;
  }
}
