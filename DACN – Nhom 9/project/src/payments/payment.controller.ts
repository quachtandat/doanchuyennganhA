import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Req,
  Res,
  UseGuards,
  HttpStatus,
  Param,
} from '@nestjs/common';
import type { Response } from 'express';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('payment')
export class PaymentController {
  constructor(private paymentService: PaymentService) {
    console.log(' PaymentController initialized');
  }

  @Post('momo/create')
  @UseGuards(JwtAuthGuard)
  async createMomo(@Req() req: any, @Body('amount') amount: number) {
    console.log('🔥 Request user:', req.user);

    const userId = req.user.userId || req.user.id;

    if (!userId) {
      return { success: false, message: 'User not authenticated' };
    }

    //  Validate amount
    if (!amount || amount < 1000) {
      return { success: false, message: 'Số tiền tối thiểu là 1,000đ' };
    }

    try {
      const paymentData = await this.paymentService.createMomoPayment(
        userId,
        amount,
      );
      return {
        success: true,
        ...paymentData, //  Return all payment data including QR code
      };
    } catch (error) {
      console.error('❌ Payment error:', error);
      return { success: false, message: error.message };
    }
  }

  @Post('momo-ipn')
  async momoIPN(@Body() data: any, @Res() res: Response) {
    console.log('📨 IPN Endpoint hit:', new Date().toISOString());
    console.log('📨 IPN Data:', JSON.stringify(data, null, 2));

    try {
      await this.paymentService.handleMomoIPN(data);
      console.log(' IPN processed successfully');
      return res.status(HttpStatus.OK).json({
        message: 'Success',
        resultCode: 0,
      });
    } catch (error) {
      console.error('❌ IPN Error:', error);
      return res.status(HttpStatus.OK).json({
        message: 'Failed',
        resultCode: -1,
      });
    }
  }

  @Get('momo-return')
  async momoReturn(@Query() query: any, @Res() res: Response) {
    console.log('🔄 Return Endpoint hit:', new Date().toISOString());
    console.log('🔄 Return Query:', JSON.stringify(query, null, 2));

    const result = await this.paymentService.handleMomoReturn(query);

    if (result.success) {
      return res.redirect(
        `/account?deposit_success=true&amount=${result.amount}`,
      );
    } else {
      return res.redirect(
        `/account?deposit_success=false&message=${encodeURIComponent(result.message)}`,
      );
    }
  }

  //  TEST: Simulate successful payment (development only)
  @Post('test/simulate-success')
  @UseGuards(JwtAuthGuard)
  async simulateSuccess(@Req() req: any, @Body('orderId') orderId: string) {
    if (process.env.NODE_ENV === 'production') {
      return { success: false, message: 'Not available in production' };
    }

    const userId = req.user.userId || req.user.id;

    // Tìm payment
    const payment = await this.paymentService.checkPaymentStatus(orderId);
    if (!payment) {
      return { success: false, message: 'Payment not found' };
    }

    // Simulate IPN success
    const mockIPN = {
      partnerCode: 'MOMOBKUN20180529',
      orderId: payment.orderId,
      requestId: payment.orderId,
      amount: payment.amount,
      orderInfo: `Nạp ${payment.amount.toLocaleString('vi-VN')}đ`,
      orderType: 'momo_wallet',
      transId: Date.now(),
      resultCode: 0, //  Success
      message: 'Thành công',
      payType: 'qr',
      responseTime: Date.now(),
      extraData: Buffer.from(JSON.stringify({ userId })).toString('base64'),
      signature: 'test_signature',
    };

    try {
      await this.paymentService.handleMomoIPN(mockIPN);
      return {
        success: true,
        message: 'Payment simulated successfully',
        orderId: payment.orderId,
        amount: payment.amount,
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getHistory(@Req() req: any) {
    const userId = req.user.userId || req.user.id;
    const history = await this.paymentService.getHistory(userId);
    return { success: true, data: history };
  }

  // Thêm endpoint check status
  @Get('status/:orderId')
  @UseGuards(JwtAuthGuard)
  async checkStatus(@Param('orderId') orderId: string) {
    const payment = await this.paymentService.checkPaymentStatus(orderId);
    if (!payment) {
      return { success: false, message: 'Payment not found' };
    }
    return {
      success: true,
      data: {
        orderId: payment.orderId,
        amount: payment.amount,
        status: payment.status,
        transactionId: payment.transactionId,
      },
    };
  }
}
