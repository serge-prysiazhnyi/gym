import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workout } from './workout.entity';
import { WorkoutSet } from './workout-set.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Workout, WorkoutSet])],
})
export class WorkoutsModule {}
