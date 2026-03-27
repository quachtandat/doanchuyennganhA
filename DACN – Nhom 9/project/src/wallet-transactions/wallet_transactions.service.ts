import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WalletTransaction } from './schemas/wallet_transactions.schema';
import { CreateWalletTransactionDto } from './dto/create-wallet_transaction.dto';
import { UpdateWalletTransactionDto } from './dto/update-wallet_transaction.dto';

@Injectable()
export class WalletTransactionsService {
  constructor(
    @InjectModel(WalletTransaction.name)
    private readonly walletTxModel: Model<WalletTransaction>,
  ) {}

  async create(dto: CreateWalletTransactionDto): Promise<WalletTransaction> {
    const tx = new this.walletTxModel(dto);
    return tx.save();
  }

  async findAll(): Promise<WalletTransaction[]> {
    return this.walletTxModel
      .find()
      .populate('userId', 'name email')
      .populate('relatedPaymentId', 'provider amountVnd status')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string): Promise<WalletTransaction> {
    const tx = await this.walletTxModel
      .findById(id)
      .populate('userId', 'name email')
      .populate('relatedPaymentId', 'provider amountVnd status')
      .exec();
    if (!tx) throw new NotFoundException('Wallet transaction not found');
    return tx;
  }

  async update(
    id: string,
    dto: UpdateWalletTransactionDto,
  ): Promise<WalletTransaction> {
    const updated = await this.walletTxModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Wallet transaction not found');
    return updated;
  }

  async remove(id: string): Promise<void> {
    const result = await this.walletTxModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('Wallet transaction not found');
  }
}
