import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsMongoId,
  IsArray,
  IsEnum,
  IsNumber,
} from 'class-validator';

export class CreateStoryDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsMongoId()
  authorId: string;

  @IsOptional()
  @IsArray()
  category?: string[];

  @IsOptional()
  @IsString()
  coverUrl?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(['pending', 'published', 'rejected'])
  status?: string;

  @IsOptional()
  @IsNumber()
  expectedTotalChapters?: number;
}
