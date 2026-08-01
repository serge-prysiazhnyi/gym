import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis';

import { UserResponseDto } from './dto/user-response.dto';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async getById(id: string): Promise<UserResponseDto> {
    const key = `user:${id}`;

    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached) as UserResponseDto;
    }

    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const dto = this.toDto(user);
    await this.redis.set(key, JSON.stringify(dto), 'EX', 60);
    return dto;
  }

  async findAll(page: number, limit: number) {
    const [data, total] = await this.users.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data: data.map((user) => this.toDto(user)),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  private toDto(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
    };
  }
}
