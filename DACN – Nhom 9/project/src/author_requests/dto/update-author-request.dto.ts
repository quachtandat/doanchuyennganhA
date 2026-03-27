import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateAuthorRequestDto {
  @IsIn(['approved', 'rejected'])
  status: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  adminNote?: string;
}


