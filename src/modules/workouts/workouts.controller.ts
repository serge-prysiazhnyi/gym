import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  Patch,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WorkoutsService } from './workouts.service';
import {
  CreateWorkoutDto,
  UpdateWorkoutDto,
  CreateWorkoutSetDto,
  UpdateWorkoutSetDto,
} from './dto/create-workout.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JwtAuthGuard, CurrentUser, type AuthenticatedUser } from '../auth';

@Controller('workouts')
@UseGuards(JwtAuthGuard) // applies to every route in this controller
export class WorkoutsController {
  constructor(private readonly workouts: WorkoutsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWorkoutDto,
  ) {
    return this.workouts.create(user.userId, dto);
  }

  @Get()
  getAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.workouts.findAllForUser(user.userId, query.page, query.limit);
  }

  @Get(':id')
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.workouts.findOneForUser(user.userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkoutDto,
  ) {
    return this.workouts.update(user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.workouts.remove(user.userId, id);
  }

  @Post(':id/sets')
  addSet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateWorkoutSetDto,
  ) {
    return this.workouts.addSet(user.userId, id, dto);
  }

  @Patch(':id/sets/:setId')
  updateSet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('setId', ParseUUIDPipe) setId: string,
    @Body() dto: UpdateWorkoutSetDto,
  ) {
    return this.workouts.updateSet(user.userId, id, setId, dto);
  }

  @Delete(':id/sets/:setId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeSet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('setId', ParseUUIDPipe) setId: string,
  ) {
    return this.workouts.removeSet(user.userId, id, setId);
  }
}
