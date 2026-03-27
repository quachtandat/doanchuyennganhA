import {
  IsString,
  IsInt,
  IsDateString,
  IsOptional,
  IsIn,
  Min,
  Max,
} from 'class-validator';

export class CreatePromotionDto {
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(0)
  @Max(100)
  bonusPercent: number;

  @IsDateString()
  validFrom: string;

  @IsDateString()
  validTo: string;

  @IsString()
  @IsIn(['active', 'expired'])
  status: string;
}
