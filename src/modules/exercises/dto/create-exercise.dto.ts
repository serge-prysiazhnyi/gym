/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  ArrayMinSize,
  IsArray,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  IsUrl,
  IsOptional,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateExerciseDto {
  @IsString()
  @MinLength(2)
  @MaxLength(128)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true }) // validate EVERY id in the array
  muscleGroupIds!: string[];

  @IsOptional()
  @IsUrl()
  @MaxLength(512)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;
}
