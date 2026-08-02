import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Workout } from './workout.entity';
import { WorkoutSet } from './workout-set.entity';
import { Exercise } from '../exercises';
import { CreateWorkoutDto } from './dto/create-workout.dto';

@Injectable()
export class WorkoutsService {
  constructor(
    @InjectRepository(Workout) private readonly workouts: Repository<Workout>,
    private readonly dataSource: DataSource,
  ) {}

  async create(userId: string, dto: CreateWorkoutDto): Promise<Workout> {
    // Validate exercise ids BEFORE opening the transaction
    const ids = [...new Set(dto.sets.map((s) => s.exerciseId))];
    const found = await this.dataSource
      .getRepository(Exercise)
      .findBy({ id: In(ids) });

    if (found.length !== ids.length) {
      throw new BadRequestException(
        'One or more exerciseId values are invalid',
      );
    }

    // Transaction: workout + all its sets succeed together, or not at all
    return this.dataSource.transaction(async (manager) => {
      const workout = manager.create(Workout, {
        userId,
        performedAt: dto.performedAt ? new Date(dto.performedAt) : new Date(),
        rawText: dto.rawText ?? null,
        durationSeconds: dto.durationSeconds ?? null,
      });
      await manager.save(workout);

      const sets = dto.sets.map((s) =>
        manager.create(WorkoutSet, {
          workoutId: workout.id,
          exerciseId: s.exerciseId,
          setNumber: s.setNumber,
          reps: s.reps,
          eightKg: s.weightKg != null ? String(s.weightKg) : null,
        }),
      );
      await manager.insert(WorkoutSet, sets); // bulk insert — one statement

      return { ...workout, sets };
    });
  }

  async findAllForUser(userId: string, page = 1, limit = 20) {
    const [data, total] = await this.workouts.findAndCount({
      where: { userId },
      relations: { sets: { exercise: true } },
      skip: (page - 1) * limit,
      take: limit,
      order: { performedAt: 'DESC' },
    });

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findOneForUser(userId: string, id: string) {
    const workout = await this.workouts.findOne({
      where: { id, userId }, // ← id AND owner
      relations: { sets: { exercise: true } },
    });

    if (!workout) throw new NotFoundException('Workout not found');

    return workout;
  }
}
