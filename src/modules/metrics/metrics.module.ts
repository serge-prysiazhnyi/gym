import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { WORKOUT_PARSE_QUEUE } from '../queue';

@Module({
  imports: [BullModule.registerQueue({ name: WORKOUT_PARSE_QUEUE })],
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
