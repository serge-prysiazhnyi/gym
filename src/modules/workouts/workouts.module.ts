import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workout } from './workout.entity';
import { WorkoutSet } from './workout-set.entity';
import { WorkoutsService } from './workouts.service';
import { WorkoutsController } from './workouts.controller';
import { WorkoutParseProcessor } from './workout-parse.processor';
import { ExercisesModule } from '../exercises';
import { QueueModule } from '../queue';
import { LlmModule } from '../llm';

@Module({
  imports: [
    TypeOrmModule.forFeature([Workout, WorkoutSet]),
    ExercisesModule,
    QueueModule, // provides the workout-parse queue WorkoutsService injects
    LlmModule, // used by WorkoutParseProcessor to parse raw workout text
  ],
  controllers: [WorkoutsController],
  providers: [WorkoutsService, WorkoutParseProcessor],
  exports: [WorkoutsService],
})
export class WorkoutsModule {}
