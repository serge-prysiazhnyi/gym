import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateWorkoutSetDto {
  @IsUUID()
  exerciseId!: string;

  @IsInt()
  @Min(1)
  @Max(100)
  setNumber!: number;

  @IsInt()
  @Min(1)
  @Max(1000)
  reps!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000)
  weightKg?: number;
}

export class CreateWorkoutDto {
  @IsOptional()
  @IsISO8601()
  performedAt?: string;

  @IsOptional()
  @IsString()
  rawText?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationSeconds?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true }) // validate each object in the array
  @Type(() => CreateWorkoutSetDto) // tells class-transformer what class to build
  sets!: CreateWorkoutSetDto[];
}
