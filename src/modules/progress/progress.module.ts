import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WorkoutsModule, WorkoutSet } from '../workouts';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';

@Module({
  // ProgressService queries WorkoutSet directly (via @InjectRepository), so
  // this module needs its own forFeature registration — WorkoutsModule only
  // exports WorkoutsService, not the repository providers it registers.
  imports: [TypeOrmModule.forFeature([WorkoutSet]), WorkoutsModule],
  controllers: [ProgressController],
  providers: [ProgressService],
  exports: [ProgressService],
})
export class ProgressModule {}
