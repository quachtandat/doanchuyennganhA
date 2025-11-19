import {
  IsString,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsMongoId,
  IsIn,
} from 'class-validator';

export class CreateChapterDto {
  @IsMongoId()
  storyId: string;

  @IsString()
  title: string;

  @IsNumber()
  number: number;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsBoolean()
  isVip?: boolean;

  @IsOptional()
  @IsNumber()
  priceCoins?: number;

  @IsOptional()
  @IsIn(['draft', 'published', 'removed'])
  status?: string;
}
