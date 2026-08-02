import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Exercise } from './exercise.entity';
import { MuscleGroupsService } from '../muscle-groups';
import { CreateExerciseDto } from './dto/create-exercise.dto';

@Injectable()
export class ExercisesService {
  constructor(
    @InjectRepository(Exercise) private readonly repo: Repository<Exercise>,
    private readonly muscleGroups: MuscleGroupsService,
  ) {}

  async findAll(page = 1, limit = 20) {
    const [data, total] = await this.repo.findAndCount({
      relations: { muscleGroups: true }, // <-- to avoid N+1
      skip: (page - 1) * limit,
      take: limit,
      order: { name: 'ASC' },
    });

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const exercise = await this.repo.findOne({
      where: { id },
      relations: { muscleGroups: true },
    });

    if (!exercise) {
      throw new NotFoundException('Exercise not found');
    }

    return exercise;
  }

  async create(dto: CreateExerciseDto) {
    const existing = await this.repo
      .createQueryBuilder('e')
      .where('LOWER(e.name) = LOWER(:name)', { name: dto.name })
      .getOne();

    if (existing) {
      throw new ConflictException('Exercise already exists');
    }

    // resolve ids → entities via the other module's public API
    const groups = await this.muscleGroups.findByIds(dto.muscleGroupIds);

    if (groups.length !== dto.muscleGroupIds.length) {
      throw new BadRequestException('One or more muscle group ids are invalid');
    }

    const exercise = this.repo.create({
      name: dto.name,
      muscleGroups: groups,
      description: dto.description ?? null,
      imageUrl: dto.imageUrl ?? null,
    });

    return this.repo.save(exercise);
  }

  /**
   * Check whether an exercise exists.
   *
   * Public entry point for other modules (notably `WorkoutsService`) that need
   * to validate an exerciseId without loading the full entity or its relations.
   */
  async exists(id: string): Promise<boolean> {
    return this.repo.existsBy({ id });
  }

  /**
   * Return which of the given exercise ids actually exist.
   * Used to validate a batch of ids in one query rather than N queries.
   */
  async findExistingIds(ids: string[]): Promise<string[]> {
    const rows = await this.repo.find({
      where: { id: In(ids) },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }
}
