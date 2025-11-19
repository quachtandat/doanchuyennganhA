import { IsOptional, IsString } from 'class-validator';

export class CreateAuthorRequestDto {
  @IsOptional()
  @IsString()
  message?: string;
}


