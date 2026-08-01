import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MuscleGroup } from './muscle-group.entity';
import { MuscleGroupsService } from './muscle-groups.service';
import { MuscleGroupsController } from './muscle-groups.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MuscleGroup])],
  controllers: [MuscleGroupsController],
  providers: [MuscleGroupsService],
  // the Exercises module will need to look up muscle groups,
  // and this is how it accesses them through the front door rather than reaching into internals.
  // That's the module boundary for modular monolith
  exports: [MuscleGroupsService],
})
export class MuscleGroupsModule {}
