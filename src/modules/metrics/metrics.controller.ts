/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Controller, Get, Header } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    @InjectDataSource() private readonly dataSource: DataSource,
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
    return this.metrics.registry.metrics();
  }
}
