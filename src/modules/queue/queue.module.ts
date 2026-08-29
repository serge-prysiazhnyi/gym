import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ConfigModule, ConfigService } from '@nestjs/config';

export const WORKOUT_PARSE_QUEUE = 'workout-parse';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Bull Board is a queue admin UI. It exposes job payloads and allows
 * retrying/deleting jobs, so it is only mounted outside production.
 */
const bullBoardImports = isDev
  ? [
      BullBoardModule.forRoot({
        route: '/admin/queues',
        adapter: ExpressAdapter,
      }),
      BullBoardModule.forFeature({
        name: WORKOUT_PARSE_QUEUE,
        adapter: BullMQAdapter,
      }),
    ]
  : [];

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
    ...bullBoardImports,
  ],
  exports: [BullModule],
})
export class QueueModule {}
