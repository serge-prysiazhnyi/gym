import { Controller, Get, Param, UseGuards, Query } from '@nestjs/common';

import { Roles, RolesGuard, JwtAuthGuard } from '../auth';
import { UsersService } from './users.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  listAllUsers(@Query() query: PaginationQueryDto) {
    return this.users.findAll(query.page, query.limit);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  getOne(@Param('id') id: string) {
    return this.users.getById(id);
  }
}
