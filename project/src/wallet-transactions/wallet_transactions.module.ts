import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WalletTransactionsService } from './wallet_transactions.service';
import { WalletTransactionsController } from './wallet_transactions.controller';
import {
  WalletTransaction,
  WalletTransactionSchema,
} from './schemas/wallet_transactions.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WalletTransaction.name, schema: WalletTransactionSchema },
    ]),
  ],
  controllers: [WalletTransactionsController],
  providers: [WalletTransactionsService],
  exports: [WalletTransactionsService],
})
export class WalletTransactionsModule {}
