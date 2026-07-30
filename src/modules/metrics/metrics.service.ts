import { Injectable } from '@nestjs/common';
import { Registry, collectDefaultMetrics, Gauge } from 'prom-client';

@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  /** Postgres pool gauges — the numbers actually to watch. */
  readonly poolTotal = new Gauge({
    name: 'db_pool_total',
    help: 'Total connections in the pool',
    registers: [this.registry],
  });

  readonly poolIdle = new Gauge({
    name: 'db_pool_idle',
    help: 'Idle (free) connections',
    registers: [this.registry],
  });

  readonly poolWaiting = new Gauge({
    name: 'db_pool_waiting',
    help: 'Requests queued waiting for a connection',
    registers: [this.registry],
  });

  constructor() {
    // Node process metrics: CPU, memory, event-loop lag, GC
    collectDefaultMetrics({ register: this.registry });
  }
}
