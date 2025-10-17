import {
  IsBoolean,
  IsDate,
  IsMongoId,
  IsNumber,
  IsOptional,
} from 'class-validator';

export class CreateReadingHistoryDto {
  @IsMongoId()
  userId: string;

  @IsMongoId()
  storyId: string;

  @IsOptional()
  @IsMongoId()
  lastChapterId?: string;

  @IsOptional()
  @IsDate()
  lastReadAt?: Date;

  @IsOptional()
  @IsNumber()
  progress?: number;

  @IsOptional()
  @IsBoolean()
  isFinished?: boolean;
}
