import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import type { MuscleGroup } from '../muscle-groups';

@Entity('exercises')
export class Exercise {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 128, unique: true })
  name!: string;

  /**
   * Longer description of how to perform the exercise. Optional.
   */
  @Column({ type: 'text', nullable: true })
  description!: string | null;

  /**
   * URL of an illustrative image. Optional.
   *
   * Stores a URL rather than the image itself — binary data belongs in object
   * storage (S3 or similar), not in Postgres.
   */
  @Column({ type: 'varchar', length: 512, name: 'image_url', nullable: true })
  imageUrl!: string | null;

  // target given as a string (not `() => MuscleGroup`) to avoid a runtime
  // circular import between the exercises and muscle-groups modules
  @ManyToMany('MuscleGroup', (m: MuscleGroup) => m.exercises)
  @JoinTable({ name: 'exercise_muscle_groups' }) // owns the join table
  muscleGroups!: MuscleGroup[];
}
