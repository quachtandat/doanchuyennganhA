/* eslint-disable prettier/prettier */

import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Param,
} from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BuyCoinsDto } from './dto/buy-coins.dto';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  /**
   * 🔍 KIỂM TRA ĐÃ MUA CHƯƠNG CHƯA
   * GET /wallet/check-purchase/:chapterId
   */
  @Get('check-purchase/:chapterId')
  async checkPurchase(@Request() req, @Param('chapterId') chapterId: string) {
    return this.walletService.checkPurchase(req.user.userId, chapterId);
  }

  /**
   * 💰 MUA COINS (Dùng Postman để test)
   * POST /wallet/buy-coins
   * Body: { "amount": 1000, "paymentMethod": "test" }
   */
  @Post('buy-coins')
  async buyCoins(@Request() req, @Body() buyCoinsDto: BuyCoinsDto) {
    return this.walletService.buyCoins(req.user.userId, buyCoinsDto);
  }

  /**
   * 📜 LỊCH SỬ GIAO DỊCH
   * GET /wallet/transactions
   */
  @Get('transactions')
  async getTransactions(@Request() req) {
    return this.walletService.getTransactions(req.user.userId);
  }

  /**
   * 🔓 MUA CHƯƠNG (Unlock Chapter)
   * POST /wallet/unlock-chapter/:chapterId
   */
  @Post('unlock-chapter/:chapterId')
  async unlockChapter(@Request() req, @Param('chapterId') chapterId: string) {
    return this.walletService.unlockChapter(req.user.userId, chapterId);
  }
}
