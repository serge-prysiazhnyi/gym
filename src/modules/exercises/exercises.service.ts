import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import Redis from 'ioredis';

import { Exercise } from './exercise.entity';
import { MuscleGroupsService } from '../muscle-groups';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { REDIS_CLIENT } from '../redis';

const CATALOGUE_CACHE_KEY = 'exercises:catalogue';
const CATALOGUE_CACHE_TTL = 3600; // 1 hour — invalidated on create anyway

/** Minimal view of an exercise for matching free text against the catalogue. */
export interface CatalogueEntry {
  id: string;
  name: string;
}

@Injectable()
export class ExercisesService {
  constructor(
    @InjectRepository(Exercise) private readonly repo: Repository<Exercise>,
    private readonly muscleGroups: MuscleGroupsService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
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

    const saved = await this.repo.save(exercise);
    await this.redis.del(CATALOGUE_CACHE_KEY);
    return saved;
  }

  /**
   * Every exercise as `{ id, name }`, cached in Redis.
   *
   * The AI parser restricts the model to these names and maps them back to
   * ids, so one cached read replaces a `findByName` query per exercise.
   */
  async getCatalogue(): Promise<CatalogueEntry[]> {
    const cached = await this.redis.get(CATALOGUE_CACHE_KEY);
    if (cached) return JSON.parse(cached) as CatalogueEntry[];

    const catalogue = await this.repo.find({
      select: { id: true, name: true },
      order: { name: 'ASC' },
    });

    await this.redis.set(
      CATALOGUE_CACHE_KEY,
      JSON.stringify(catalogue),
      'EX',
      CATALOGUE_CACHE_TTL,
    );
    return catalogue;
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

  /**
   * Find an exercise by name, case-insensitively.
   *
   * Used when resolving free-text exercise names (e.g. from LLM output) to
   * catalogue entries. Returns null when no match exists.
   */
  async findByName(name: string): Promise<Exercise | null> {
    return this.repo
      .createQueryBuilder('e')
      .where('LOWER(e.name) = LOWER(:name)', { name: name.trim() })
      .getOne();
  }
}
