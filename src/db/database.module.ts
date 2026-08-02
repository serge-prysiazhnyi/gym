import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isDev = config.get<string>('NODE_ENV') !== 'production';

        return {
          type: 'postgres',
          url: config.get<string>('DATABASE_URL'),
          autoLoadEntities: true,
          synchronize: false,
          logging: isDev ? ['query', 'error'] : ['error'],
          extra: { max: 20 },
        };
      },
    }),
  ],
})
export class DatabaseModule {}
