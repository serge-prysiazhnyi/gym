import 'dotenv/config';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { User } from './modules/users/user.entity';
import { Workout } from './modules/workouts/workout.entity';
import { WorkoutSet } from './modules/workouts/workout-set.entity';
import { Exercise } from './modules/exercises/exercise.entity';
import { MuscleGroup } from './modules/muscle-groups/muscle-group.entity';

// Resolved relative to this file so the same DataSource works both ways this
// project runs it: under ts-node from src/ in development, and as compiled
// JS from dist/src/ in production (no TypeScript needed at runtime there).
const isCompiled = __filename.endsWith('.js');

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [User, Workout, WorkoutSet, Exercise, MuscleGroup],
  migrations: [join(__dirname, `migrations/*.${isCompiled ? 'js' : 'ts'}`)],
  synchronize: false,
});
