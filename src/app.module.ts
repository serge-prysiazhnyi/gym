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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
