import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,

      autoLoadEntities: true, // picks up entities registered by feature modules
      synchronize: false, // NEVER true — you use migrations
      logging: ['query', 'error'], // <-- shows the SQL, for your learning goal

      // THE POOL — this is your tunable knob under load
      extra: {
        max: 10, // pool size
      },
    }),
  ],
})
export class DatabaseModule {}
