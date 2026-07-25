import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm';
import { Exercise } from './exercise.entity';

@Entity('muscle_groups')
export class MuscleGroup {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 64, unique: true })
  name!: string;

  @ManyToMany(() => Exercise, (e) => e.muscleGroups)
  exercises!: Exercise[];
}
