import 'dotenv/config';
import { DataSource } from 'typeorm';
import { User } from './modules/users/user.entity';
import { Workout } from './modules/workouts/workout.entity';
import { WorkoutSet } from './modules/workouts/workout-set.entity';
import { Exercise } from './modules/exercises/exercise.entity';
import { MuscleGroup } from './modules/muscle-groups/muscle-group.entity';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [User, Workout, WorkoutSet, Exercise, MuscleGroup],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
});
