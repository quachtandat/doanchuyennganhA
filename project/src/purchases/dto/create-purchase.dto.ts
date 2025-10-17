import { IsEnum, IsMongoId, IsNotEmpty, IsNumber } from 'class-validator';

export class CreatePurchaseDto {
  @IsMongoId()
  @IsNotEmpty()
  userId: string;

  @IsMongoId()
  @IsNotEmpty()
  chapterId: string;

  @IsMongoId()
  @IsNotEmpty()
  storyId: string;

  @IsNumber()
  @IsNotEmpty()
  priceCoins: number;

  @IsEnum(['wallet', 'promo', 'gift'])
  method: string;

  @IsEnum(['completed', 'refunded'])
  status: string;
}
