import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { MuscleGroupsService } from './muscle-groups.service';
import { CreateMuscleGroupDto } from './dto/create-muscle-group.dto';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth';

@Controller('muscle-groups')
export class MuscleGroupsController {
  constructor(private readonly muscleGroups: MuscleGroupsService) {}

  /** Any authenticated user can read the catalogue. */
  @Get()
  @UseGuards(JwtAuthGuard)
  getAll() {
    return this.muscleGroups.findAll();
  }

  /** Only admins can extend the catalogue. */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  create(@Body() dto: CreateMuscleGroupDto) {
    return this.muscleGroups.create(dto);
  }
}
