import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { In, Repository } from 'typeorm';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { MuscleGroup } from './muscle-group.entity';
import { CreateMuscleGroupDto } from './dto/create-muscle-group.dto';

const CACHE_KEY = 'muscle-groups:all';
const CACHE_TTL = 3600; // 1 hour — this data almost never changes

@Injectable()
export class MuscleGroupsService {
  constructor(
    @InjectRepository(MuscleGroup)
    private readonly repo: Repository<MuscleGroup>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async findAll(): Promise<MuscleGroup[]> {
    const cached = await this.redis.get(CACHE_KEY);

    if (!!cached && cached?.length > 0)
      return JSON.parse(cached) as MuscleGroup[];

    const groups = await this.repo.find({ order: { name: 'ASC' } });

    await this.redis.set(CACHE_KEY, JSON.stringify(groups), 'EX', CACHE_TTL);
    return groups;
  }

  async findById(ids: string[]): Promise<MuscleGroup[]> {
    return await this.repo.findBy({ id: In(ids) });
  }

  async create(dto: CreateMuscleGroupDto): Promise<MuscleGroup> {
    const existing = await this.repo.findOne({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException('Muscle group already exists');
    }

    const group = this.repo.create(dto);
    await this.repo.save(group);

    await this.redis.del(CACHE_KEY);

    return group;
  }
}
