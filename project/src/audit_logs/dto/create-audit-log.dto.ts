import { IsMongoId, IsString, IsOptional, IsObject } from 'class-validator';

export class CreateAuditLogDto {
  @IsMongoId()
  actorId: string;

  @IsString()
  action: string;

  @IsString()
  target: string;

  @IsOptional()
  @IsObject()
  details?: Record<string, any> | string;
}
