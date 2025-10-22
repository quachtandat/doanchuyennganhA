import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { User, UserSchema } from '../users/schemas/user.schema';
import {
  WalletTransaction,
  WalletTransactionSchema,
} from '../wallet-transactions/schemas/wallet_transactions.schema';
import { Chapter, ChapterSchema } from '../chapters/schemas/chapters.schema';
import {
  Purchase,
  PurchaseSchema,
} from '../purchases/schemas/purchases.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: WalletTransaction.name, schema: WalletTransactionSchema },
      { name: Chapter.name, schema: ChapterSchema },
      { name: Purchase.name, schema: PurchaseSchema },
    ]),
  ],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
