import {
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateWalletTransactionDto {
  @IsMongoId() userId: string;
  @IsEnum(['topup', 'purchase', 'bonus', 'admin_adjust']) type: string;
  @IsInt() amountCoins: number;
  @IsInt() balanceAfter: number;
  @IsOptional() @IsMongoId() relatedPaymentId?: string;
  @IsOptional() @IsString() note?: string;
  @IsEnum(['pending', 'completed', 'failed']) status: string;
}
