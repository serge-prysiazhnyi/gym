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

  // target given as a string (not `() => MuscleGroup`) to avoid a runtime
  // circular import between the exercises and muscle-groups modules
  @ManyToMany('MuscleGroup', (m: MuscleGroup) => m.exercises)
  @JoinTable({ name: 'exercise_muscle_groups' }) // owns the join table
  muscleGroups!: MuscleGroup[];
}
