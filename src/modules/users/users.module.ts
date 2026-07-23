import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../db/database.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { USERS_REPOSITORY } from './users.repository';
import { DrizzleUsersRepository } from './drizzle-users.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [UsersController],
  providers: [
    UsersService,
    {
      provide: USERS_REPOSITORY,
      useClass: DrizzleUsersRepository,
    },
  ],
})
export class UsersModule {}
