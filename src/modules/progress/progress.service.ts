import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { WorkoutSet } from '../workouts';
import { GroupBy, VolumeQueryDto } from './dto/volume-query.dto';

export interface VolumePoint {
  period: string;
  muscleGroup: string;
  totalVolume: number;
  totalSets: number;
}

@Injectable()
export class ProgressService {
  constructor(
    @InjectRepository(WorkoutSet) private readonly sets: Repository<WorkoutSet>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async volumeByMuscleGroup(
    userId: string,
    query: VolumeQueryDto,
  ): Promise<VolumePoint[]> {
    const from = query.from ?? '2000-01-01';
    const to = query.to ?? new Date().toISOString().slice(0, 10);
    const groupBy = query.groupBy ?? GroupBy.WEEK;

    const cacheKey = `progress:volume:${userId}:${from}:${to}:${groupBy}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as VolumePoint[];

    const rows = await this.sets
      .createQueryBuilder('s')
      .innerJoin('s.workout', 'w')
      .innerJoin('s.exercise', 'e')
      .innerJoin('e.muscleGroups', 'mg')
      .select(`DATE_TRUNC('${groupBy}', w.performed_at)`, 'period')
      .addSelect('mg.name', 'muscleGroup')
      .addSelect('SUM(s.reps * COALESCE(s.weight_kg, 0))', 'totalVolume')
      .addSelect('COUNT(s.id)', 'totalSets')
      .where('w.user_id = :userId', { userId })
      .andWhere('w.performed_at >= :from', { from })
      .andWhere('w.performed_at <= :to', { to })
      .groupBy('period')
      .addGroupBy('mg.name')
      .orderBy('period', 'ASC')
      .getRawMany<{
        period: Date;
        muscleGroup: string;
        totalVolume: string;
        totalSets: string;
      }>();

    const result: VolumePoint[] = rows.map((r) => ({
      period: r.period.toISOString().slice(0, 10),
      muscleGroup: r.muscleGroup,
      totalVolume: Number(r.totalVolume),

      totalSets: Number(r.totalSets),
    }));

    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 300);

    return result;
  }
}
