import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

// Same pattern as USERS_REPOSITORY earlier.
// Redis is a class from a library, so it could be injected directly, but a token keeps it swappable and consistent with other DI.
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

// Redis is cross-cutting infrastructure, so making it global means any module can inject it without re-importing.
// This is a legitimate use of @Global; use it sparingly, but caching qualifies.
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Redis(config.get<string>('REDIS_URL')!),
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
