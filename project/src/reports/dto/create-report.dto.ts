import { IsMongoId, IsOptional, IsString, IsEnum } from 'class-validator';

export class CreateReportDto {
  @IsOptional()
  @IsMongoId()
  userId?: string;

  @IsMongoId()
  storyId: string;

  @IsOptional()
  @IsMongoId()
  chapterId?: string;

  @IsString()
  reason: string;

  @IsOptional()
  @IsEnum(['pending', 'resolved'])
  status?: string;
}
