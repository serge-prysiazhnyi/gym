import type { User } from '../../db/schema';

export interface UsersRepository {
  findById(id: string): Promise<User | null>;
}

export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY');
