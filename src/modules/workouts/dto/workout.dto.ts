import { Transform, Type } from 'class-transformer';
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
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { sanitizeWorkoutText } from '../workout-input.validator';

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

export class UpdateWorkoutDto {
  @IsOptional()
  @IsISO8601()
  performedAt?: string;

  @IsOptional()
  @IsString()
  rawText?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;
}

export class UpdateWorkoutSetDto {
  @IsOptional()
  @IsUUID()
  exerciseId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  setNumber?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  reps?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000)
  weightKg?: number;
}

export class ParseWorkoutDto {
  // Sanitised before the length checks, so invisible characters can't pad
  // the text past the minimum or hide instructions from the pre-filter.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? sanitizeWorkoutText(value) : value,
  )
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  rawText!: string;
}
