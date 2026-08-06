import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

export const WORKOUT_PARSE_QUEUE = 'workout-parse';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.get<string>('REDIS_URL') },
      }),
    }),
    BullModule.registerQueue({ name: WORKOUT_PARSE_QUEUE }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
