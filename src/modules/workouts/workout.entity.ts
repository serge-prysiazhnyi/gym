import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';
import { WorkoutSet } from './workout-set.entity';

@Entity('workouts')
@Index('workouts_user_performed_idx', ['userId', 'performedAt'])
export class Workout {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, (u) => u.workouts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'performed_at', type: 'timestamp', default: () => 'now()' })
  performedAt!: Date;

  @Column({ name: 'raw_text', type: 'text', nullable: true })
  rawText!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'duration_seconds', type: 'int', nullable: true })
  durationSeconds!: number | null;

  @OneToMany(() => WorkoutSet, (s) => s.workout)
  sets!: WorkoutSet[];
}
