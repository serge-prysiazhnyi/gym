import { Controller, UseGuards, Get, Query } from '@nestjs/common';
import { JwtAuthGuard, CurrentUser, type AuthenticatedUser } from '../auth';
import { ProgressService } from './progress.service';
import { VolumeQueryDto } from './dto/volume-query.dto';

@Controller('progress')
@UseGuards(JwtAuthGuard)
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Get('volume')
  volume(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: VolumeQueryDto,
  ) {
    return this.progress.volumeByMuscleGroup(user.userId, query);
  }
}
