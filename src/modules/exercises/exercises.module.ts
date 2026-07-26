import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Exercise } from './exercise.entity';
import { MuscleGroup } from './muscle-group.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Exercise, MuscleGroup])],
})
export class ExercisesModule {}
