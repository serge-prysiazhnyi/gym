import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Workout } from './workout.entity';
import { WorkoutSet } from './workout-set.entity';
import {
  CreateWorkoutDto,
  UpdateWorkoutDto,
  CreateWorkoutSetDto,
  UpdateWorkoutSetDto,
} from './dto/create-workout.dto';
import { ExercisesService } from '../exercises';

@Injectable()
export class WorkoutsService {
  constructor(
    @InjectRepository(Workout) private readonly workouts: Repository<Workout>,
    @InjectRepository(WorkoutSet) private readonly sets: Repository<WorkoutSet>,
    private readonly exercises: ExercisesService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Load a workout, verifying it belongs to the given user.
   * Throws 404 (not 403) if it doesn't exist OR isn't theirs — this avoids
   * leaking whether an id exists for another user.
   */
  private async getOwnedWorkout(
    userId: string,
    workoutId: string,
  ): Promise<Workout> {
    const workout = await this.workouts.findOne({
      where: { id: workoutId, userId },
    });

    if (!workout) {
      throw new NotFoundException('Workout not found');
    }

    return workout;
  }

  async create(userId: string, dto: CreateWorkoutDto): Promise<Workout> {
    // Validate exercise ids BEFORE opening the transaction
    const ids = [...new Set(dto.sets.map((s) => s.exerciseId))];
    const existing = await this.exercises.findExistingIds(ids);

    if (existing.length !== ids.length) {
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

  async update(
    userId: string,
    id: string,
    dto: UpdateWorkoutDto,
  ): Promise<Workout> {
    const workout = await this.getOwnedWorkout(userId, id);

    if (dto.performedAt !== undefined)
      workout.performedAt = new Date(dto.performedAt);

    if (dto.durationSeconds !== undefined)
      workout.durationSeconds = dto.durationSeconds;

    if (dto.rawText !== undefined) workout.rawText = dto.rawText;

    return this.workouts.save(workout);
  }

  async remove(userId: string, id: string): Promise<void> {
    const workout = await this.getOwnedWorkout(userId, id);
    await this.workouts.remove(workout);
  }

  /**
   * Add a single set to an existing workout.
   *
   * Verifies the workout belongs to the user before touching anything, so a
   * user can never add sets to someone else's workout.
   */
  async addSet(
    userId: string,
    workoutId: string,
    dto: CreateWorkoutSetDto,
  ): Promise<WorkoutSet> {
    await this.getOwnedWorkout(userId, workoutId);

    if (!(await this.exercises.exists(dto.exerciseId))) {
      throw new BadRequestException('Invalid exerciseId');
    }

    const set = this.sets.create({
      workoutId,
      exerciseId: dto.exerciseId,
      setNumber: dto.setNumber,
      reps: dto.reps,
      weightKg: dto.weightKg != null ? String(dto.weightKg) : null,
    });
    return this.sets.save(set);
  }

  /**
   * Update one set of a workout.
   *
   * Scoped twice: the workout must belong to the user, and the set must belong
   * to that workout — so a set id from another workout cannot be edited here.
   */
  async updateSet(
    userId: string,
    workoutId: string,
    setId: string,
    dto: UpdateWorkoutSetDto,
  ): Promise<WorkoutSet> {
    await this.getOwnedWorkout(userId, workoutId);

    const set = await this.sets.findOne({ where: { id: setId, workoutId } });
    if (!set) throw new NotFoundException('Set not found');

    if (dto.exerciseId !== undefined) {
      if (!(await this.exercises.exists(dto.exerciseId))) {
        throw new BadRequestException('Invalid exerciseId');
      }
      set.exerciseId = dto.exerciseId;
    }

    if (dto.setNumber !== undefined) set.setNumber = dto.setNumber;
    if (dto.reps !== undefined) set.reps = dto.reps;
    if (dto.weightKg !== undefined) {
      set.weightKg = dto.weightKg != null ? String(dto.weightKg) : null;
    }

    return this.sets.save(set);
  }

  /**
   * Remove one set from a workout.
   *
   * The delete is scoped by both id and workoutId, so the `affected` count
   * doubles as the existence check — one query instead of a find-then-delete.
   */
  async removeSet(
    userId: string,
    workoutId: string,
    setId: string,
  ): Promise<void> {
    await this.getOwnedWorkout(userId, workoutId);

    const result = await this.sets.delete({ id: setId, workoutId });
    if (result.affected === 0) throw new NotFoundException('Set not found');
  }
}
