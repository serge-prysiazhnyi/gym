import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { MuscleGroup } from './muscle-group.entity';

@Entity('exercises')
export class Exercise {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 128, unique: true })
  name!: string;

  @ManyToMany(() => MuscleGroup, (m) => m.exercises)

  // ToDo: Need comment here
  @JoinTable({ name: 'exercise_muscle_groups' }) // owns the join table
  muscleGroups!: MuscleGroup[];
}
