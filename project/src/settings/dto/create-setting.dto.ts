import {
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

class BonusTierDto {
  @IsNumber()
  minAmount: number;

  @IsNumber()
  bonusPercent: number;
}

class MoneyToCoinDto {
  @IsNumber()
  rate: number;

  @IsNumber()
  minTopupVnd: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BonusTierDto)
  bonusTiers: BonusTierDto[];
}

export class CreateSettingDto {
  @IsString()
  @IsOptional()
  _id?: string = 'global_settings';

  @IsObject()
  @ValidateNested()
  @Type(() => MoneyToCoinDto)
  moneyToCoin: MoneyToCoinDto;

  @IsNumber()
  authorRevenueSharePercent: number;

  @IsNumber()
  platformFeePercent: number;
}
