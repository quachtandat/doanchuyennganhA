/* eslint-disable prettier/prettier */

import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { WalletTransaction } from '../wallet-transactions/schemas/wallet_transactions.schema';
import { Chapter, ChapterDocument } from '../chapters/schemas/chapters.schema';
import {
  Purchase,
  PurchaseDocument,
} from '../purchases/schemas/purchases.schema';
import { BuyCoinsDto } from './dto/buy-coins.dto';

@Injectable()
export class WalletService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(WalletTransaction.name)
    private walletTransactionModel: Model<WalletTransaction>,
    @InjectModel(Chapter.name) private chapterModel: Model<ChapterDocument>,
    @InjectModel(Purchase.name) private purchaseModel: Model<PurchaseDocument>,
  ) {}

  /**
   * 🔍 CHECK IF USER PURCHASED CHAPTER
   */
  async checkPurchase(userId: string, chapterId: string) {
    const purchase = await this.purchaseModel.findOne({
      userId: new Types.ObjectId(userId),
      chapterId: new Types.ObjectId(chapterId),
      status: 'completed',
    });

    return {
      isPurchased: !!purchase,
      chapterId,
    };
  }

  /**
   * 💰 MUA COINS
   */
  async buyCoins(userId: string, buyCoinsDto: BuyCoinsDto) {
    const { amount, paymentMethod } = buyCoinsDto;

    if (amount <= 0) {
      throw new BadRequestException('Số lượng coins phải lớn hơn 0');
    }

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const oldBalance = user.wallet_coins || 0;
    user.wallet_coins = oldBalance + amount;
    await user.save();

    const transaction = new this.walletTransactionModel({
      userId: new Types.ObjectId(userId),
      type: 'topup',
      amountCoins: amount,
      balanceAfter: user.wallet_coins,
      note: `Nạp ${amount} coins qua ${paymentMethod || 'test'}`,
      status: 'completed',
    });
    await transaction.save();

    return {
      success: true,
      message: 'Nạp coins thành công',
      newBalance: user.wallet_coins,
      transaction: {
        id: transaction._id,
        amount: transaction.amountCoins,
        type: transaction.type,
        balanceAfter: transaction.balanceAfter,
        createdAt: transaction['createdAt'],
      },
    };
  }

  /**
   * 📊 LẤY SỐ DƯ VÍ
   */
  async getBalance(userId: string) {
    const user = await this.userModel.findById(userId).select('wallet_coins');
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      userId: user._id,
      balance: user.wallet_coins || 0,
    };
  }

  /**
   * 📜 LẤY LỊCH SỬ GIAO DỊCH
   */
  async getTransactions(userId: string) {
    const transactions = await this.walletTransactionModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return {
      transactions: transactions.map((tx) => ({
        id: tx._id,
        amount: tx.amountCoins,
        type: tx.type,
        note: tx.note,
        balanceAfter: tx.balanceAfter,
        status: tx.status,
        createdAt: tx['createdAt'],
      })),
    };
  }

  /**
   * 🔓 MUA/MỞ KHÓA CHƯƠNG
   */
  async unlockChapter(userId: string, chapterId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const chapter = await this.chapterModel.findById(chapterId);
    if (!chapter) {
      throw new NotFoundException('Chapter not found');
    }

    if (!chapter.isVip) {
      throw new BadRequestException('Chương này miễn phí, không cần mua');
    }

    const existingPurchase = await this.purchaseModel.findOne({
      userId: new Types.ObjectId(userId),
      chapterId: new Types.ObjectId(chapterId),
      status: 'completed',
    });

    if (existingPurchase) {
      throw new BadRequestException('Bạn đã mua chương này rồi');
    }

    const currentBalance = user.wallet_coins || 0;
    if (currentBalance < chapter.priceCoins) {
      throw new BadRequestException(
        `Không đủ coins. Bạn cần ${chapter.priceCoins} coins, hiện tại có ${currentBalance} coins`,
      );
    }

    user.wallet_coins = currentBalance - chapter.priceCoins;
    await user.save();

    const purchase = new this.purchaseModel({
      userId: new Types.ObjectId(userId),
      chapterId: new Types.ObjectId(chapterId),
      storyId: chapter.storyId,
      priceCoins: chapter.priceCoins,
      method: 'wallet',
      status: 'completed',
      purchaseAt: new Date(),
    });
    await purchase.save();

    const transaction = new this.walletTransactionModel({
      userId: new Types.ObjectId(userId),
      type: 'purchase',
      amountCoins: -chapter.priceCoins,
      balanceAfter: user.wallet_coins,
      note: `Mua chương: ${chapter.title}`,
      status: 'completed',
    });
    await transaction.save();

    return {
      success: true,
      message: 'Mở khóa chương thành công',
      newBalance: user.wallet_coins,
      chapter: {
        id: chapter._id,
        title: chapter.title,
        price: chapter.priceCoins,
      },
      transaction: {
        id: transaction._id,
        amount: transaction.amountCoins,
        balanceAfter: transaction.balanceAfter,
      },
    };
  }
}
