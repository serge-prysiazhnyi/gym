import { IsEnum, IsISO8601, IsOptional } from 'class-validator';

export enum GroupBy {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

export class VolumeQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsEnum(GroupBy)
  groupBy: GroupBy = GroupBy.WEEK;
}
