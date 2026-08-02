import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ExercisesService } from './exercises.service';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth';

@Controller('exercises')
export class ExercisesController {
  constructor(private readonly exercises: ExercisesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  getAll(@Query() query: PaginationQueryDto) {
    return this.exercises.findAll(query.page, query.limit);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  // ParseUUIDPipe — it rejects malformed ids with a 400 before they reach the database
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.exercises.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  create(@Body() dto: CreateExerciseDto) {
    return this.exercises.create(dto);
  }
}
