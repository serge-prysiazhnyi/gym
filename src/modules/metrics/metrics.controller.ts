/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Controller, Get, Header } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { MetricsService } from './metrics.service';
import { WORKOUT_PARSE_QUEUE } from '../queue';

@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectQueue(WORKOUT_PARSE_QUEUE) private readonly parseQueue: Queue,
  ) {}

  @Get()
  @Header('Content-Type', 'text/plain')
  async scrape(): Promise<string> {
    const driver = this.dataSource.driver as any;

    const pool = driver.master;
    if (pool) {
      this.metrics.poolTotal.set(pool.totalCount ?? 0);
      this.metrics.poolIdle.set(pool.idleCount ?? 0);
      this.metrics.poolWaiting.set(pool.waitingCount ?? 0);
    }

    // --- queue gauges: one Redis round trip for all counts ---
    const counts = await this.parseQueue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
    );
    const labels = { queue: WORKOUT_PARSE_QUEUE };
    this.metrics.queueWaiting.set(labels, counts.waiting ?? 0);
    this.metrics.queueActive.set(labels, counts.active ?? 0);
    this.metrics.queueCompleted.set(labels, counts.completed ?? 0);
    this.metrics.queueFailed.set(labels, counts.failed ?? 0);
    this.metrics.queueDelayed.set(labels, counts.delayed ?? 0);

    return this.metrics.registry.metrics();
  }
}
