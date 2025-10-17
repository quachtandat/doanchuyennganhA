import {
  IsEmail,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsBoolean,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class AuthorInfoDto {
  @IsString()
  display_name: string;

  @IsBoolean()
  @IsOptional()
  verified?: boolean = false;
}

export class CreateUserDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsEnum(['reader', 'author', 'admin'])
  role?: string = 'reader';

  @IsOptional()
  @IsInt()
  @Min(0)
  wallet_coins?: number = 0;

  @IsOptional()
  @IsEnum(['active', 'blocked', 'pending'])
  status?: string = 'active';

  @IsOptional()
  @ValidateNested()
  @Type(() => AuthorInfoDto)
  @IsObject()
  author_info?: AuthorInfoDto = {
    display_name: '',
    verified: false,
  };
}
