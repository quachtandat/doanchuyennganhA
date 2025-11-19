/* eslint-disable prettier/prettier */

import { IsNumber, IsString, IsOptional, Min } from 'class-validator';

export class BuyCoinsDto {
  @IsNumber()
  @Min(1, { message: 'Số lượng coins phải lớn hơn 0' })
  amount: number;

  @IsString()
  @IsOptional()
  paymentMethod?: string;
}
