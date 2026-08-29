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

  /** Jobs waiting to be picked up — the backlog. */
  readonly queueWaiting = new Gauge({
    name: 'queue_waiting',
    help: 'Jobs waiting in the queue',
    labelNames: ['queue'],
    registers: [this.registry],
  });

  /** Jobs currently being processed — bounded by worker concurrency. */
  readonly queueActive = new Gauge({
    name: 'queue_active',
    help: 'Jobs currently being processed',
    labelNames: ['queue'],
    registers: [this.registry],
  });

  /** Jobs that exhausted all retries. */
  readonly queueFailed = new Gauge({
    name: 'queue_failed',
    help: 'Failed jobs',
    labelNames: ['queue'],
    registers: [this.registry],
  });

  /** Jobs completed successfully (kept in Redis up to removeOnComplete). */
  readonly queueCompleted = new Gauge({
    name: 'queue_completed',
    help: 'Completed jobs',
    labelNames: ['queue'],
    registers: [this.registry],
  });

  /** Jobs waiting for a retry backoff to elapse. */
  readonly queueDelayed = new Gauge({
    name: 'queue_delayed',
    help: 'Jobs waiting for retry backoff',
    labelNames: ['queue'],
    registers: [this.registry],
  });

  constructor() {
    // Node process metrics: CPU, memory, event-loop lag, GC
    collectDefaultMetrics({ register: this.registry });
  }
}
