import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './db/database.module';
import { UsersModule } from './modules/users';
import { AuthModule } from './modules/auth';
import { WorkoutsModule } from './modules/workouts';
import { ExercisesModule } from './modules/exercises';
import { MetricsModule } from './modules/metrics';
import { RedisModule } from './modules/redis';
import { MuscleGroupsModule } from './modules/muscle-groups';
import { ProgressModule } from './modules/progress';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().uri().required(),

        JWT_SECRET: Joi.string().min(32).required(),
        JWT_EXPIRES_IN: Joi.number().default(3600),

        POSTGRES_USER: Joi.string().required(),
        POSTGRES_PASSWORD: Joi.string().required(),
        POSTGRES_DB: Joi.string().required(),

        REDIS_URL: Joi.string().uri().required(),

        LLM_PROVIDER: Joi.string()
          .valid('mock', 'openai-compatible')
          .default('mock'),
        LLM_BASE_URL: Joi.string()
          .uri()
          .default('https://openrouter.ai/api/v1'),
        LLM_API_KEY: Joi.when('LLM_PROVIDER', {
          is: 'mock',
          then: Joi.string().allow('').optional(),
          otherwise: Joi.string().required(),
        }),
        LLM_MODEL: Joi.string().default(
          'mistralai/mistral-small-3.2-24b-instruct',
        ),
        LLM_FALLBACK_MODEL: Joi.string().allow('').optional(),
        LLM_TIMEOUT_MS: Joi.number().integer().min(1000).default(20000),
        LLM_MAX_OUTPUT_TOKENS: Joi.number().integer().min(100).default(1500),
        LLM_STRUCTURED_OUTPUT: Joi.boolean().default(true),
      }),
      validationOptions: {
        abortEarly: false, // report ALL bad vars at once, not just the first
      },
    }),
    DatabaseModule,
    UsersModule,
    AuthModule,
    WorkoutsModule,
    ExercisesModule,
    MetricsModule,
    RedisModule,
    MuscleGroupsModule,
    ProgressModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
