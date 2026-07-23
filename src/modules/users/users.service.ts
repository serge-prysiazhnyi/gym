import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UserResponseDto } from './dto/user-response.dto';
import { USERS_REPOSITORY, type UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(
    @Inject(USERS_REPOSITORY) private readonly users: UsersRepository,
  ) {}

  async getById(id: string): Promise<UserResponseDto> {
    const user = await this.users.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name ?? null,
      createdAt: user.createdAt,
    };
  }
}
