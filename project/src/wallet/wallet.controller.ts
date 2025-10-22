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
   * 💰 MUA COINS (Dùng Postman để test)
   * POST /wallet/buy-coins
   * Body: { "amount": 1000, "paymentMethod": "test" }
   */
  @Post('buy-coins')
  async buyCoins(@Request() req, @Body() buyCoinsDto: BuyCoinsDto) {
    return this.walletService.buyCoins(req.user.userId, buyCoinsDto);
  }

  /**
   * 📊 LẤY THÔNG TIN VÍ
   * GET /wallet/balance
   */
  @Get('balance')
  async getBalance(@Request() req) {
    return this.walletService.getBalance(req.user.userId);
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
