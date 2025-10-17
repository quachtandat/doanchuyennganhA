import {
  IsEnum,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsString,
} from 'class-validator';

export class CreatePaymentDto {
  @IsMongoId() userId: string;
  @IsEnum(['momo', 'vnpay', 'bank']) provider: string;
  @IsInt() amountVnd: number;
  @IsInt() coinsCredit: number;
  @IsInt() fee: number;
  @IsEnum(['pending', 'success', 'failed', 'chargeback']) status: string;
  @IsString() @IsNotEmpty() txRef: string;
}
