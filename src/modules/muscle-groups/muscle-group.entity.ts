import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm';
import type { Exercise } from '../exercises';

@Entity('muscle_groups')
export class MuscleGroup {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 64, unique: true })
  name!: string;

  // target given as a string (not `() => Exercise`) to avoid a runtime
  // circular import between the muscle-groups and exercises modules
  @ManyToMany('Exercise', (e: Exercise) => e.muscleGroups)
  exercises!: Exercise[];
}
