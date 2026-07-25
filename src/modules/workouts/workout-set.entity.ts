import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Workout } from './workout.entity';
import { Exercise } from '../exercises/exercise.entity';

@Entity('workout_sets')
@Index('workout_sets_workout_idx', ['workoutId'])
@Index('workout_sets_exercise_idx', ['exerciseId'])
export class WorkoutSet {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'workout_id' })
  workoutId!: string;

  @ManyToOne(() => Workout, (w) => w.sets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workout_id' })
  workout!: Workout;

  @Column({ name: 'exercise_id' })
  exerciseId!: string;

  @ManyToOne(() => Exercise)
  @JoinColumn({ name: 'exercise_id' })
  exercise!: Exercise;

  @Column({ name: 'set_number' })
  setNumber!: number;

  @Column()
  reps!: number;

  @Column('numeric', {
    name: 'weight_kg',
    precision: 6,
    scale: 2,
    nullable: true,
  })
  // numeric comes back as a string, not a number.
  // That's why weightKg is typed string. The pg driver returns numerics as strings to avoid float precision loss.
  weightKg!: string | null;
}
