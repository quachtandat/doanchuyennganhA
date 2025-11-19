import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class PaymentService {
  // MoMo Test Credentials

  private readonly PARTNER_CODE =
    process.env.MOMO_PARTNER_CODE || 'MOMOBKUN20180529';
  private readonly ACCESS_KEY =
    process.env.MOMO_ACCESS_KEY || 'klm05TvNBzhg7h7j';
  private readonly SECRET_KEY =
    process.env.MOMO_SECRET_KEY || 'at67qH6mk8w5Y1nAyMoYKMWACiEi2bsa';
  private readonly ENDPOINT =
    'https://test-payment.momo.vn/v2/gateway/api/create';

  // ✅ SỬA: Dùng ngrok hoặc domain thật thay vì localhost
  // Ví dụ: https://your-domain.com hoặc https://abc123.ngrok.io

  private readonly BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
  private readonly REDIRECT_URL = `${this.BASE_URL}/payment/momo-return`;
  private readonly IPN_URL = `${this.BASE_URL}/payment/momo-ipn`;

  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {
    console.log('💳 Payment URLs:', {
      redirect: this.REDIRECT_URL,
      ipn: this.IPN_URL,
    });
  }

  async createMomoPayment(userId: string, amount: number): Promise<any> {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    // Tạo orderId unique
    const orderId = `ORDER_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const requestId = orderId;
    const orderInfo = `Nạp ${amount.toLocaleString('vi-VN')}đ`;
    const extraData = Buffer.from(JSON.stringify({ userId })).toString(
      'base64',
    );

    console.log('📝 Creating payment:', { userId, amount, orderId });

    // Kiểm tra payment đã tồn tại chưa (tránh duplicate)
    const existingPayment = await this.paymentModel.findOne({
      orderId,
      status: 'pending',
    });

    if (existingPayment) {
      console.log('⚠️ Payment already exists:', orderId);
      throw new BadRequestException('Đơn hàng đã tồn tại, vui lòng thử lại');
    }

    // Tạo signature
    const rawSignature = `accessKey=${this.ACCESS_KEY}&amount=${amount}&extraData=${extraData}&ipnUrl=${this.IPN_URL}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${this.PARTNER_CODE}&redirectUrl=${this.REDIRECT_URL}&requestId=${requestId}&requestType=captureWallet`;

    const signature = crypto
      .createHmac('sha256', this.SECRET_KEY)
      .update(rawSignature)
      .digest('hex');

    const requestBody = {
      partnerCode: this.PARTNER_CODE,
      accessKey: this.ACCESS_KEY,
      requestId,
      amount,
      orderId,
      orderInfo,
      redirectUrl: this.REDIRECT_URL,
      ipnUrl: this.IPN_URL,
      extraData,
      requestType: 'captureWallet',
      signature,
      lang: 'vi',
    };

    console.log('🔵 MoMo Request:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(this.ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0', // ✅ Thêm User-Agent
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    console.log('🟢 MoMo Response:', JSON.stringify(data, null, 2));

    if (data.resultCode !== 0) {
      throw new BadRequestException(`MoMo error: ${data.message}`);
    }

    // Tạo payment record
    await this.paymentModel.create({
      userId: new Types.ObjectId(userId),
      orderId,
      amount,
      method: 'momo',
      status: 'pending',
    });

    console.log('✅ Payment record created:', orderId);

    // Return both payUrl and qrCodeUrl for displaying QR code
    return {
      payUrl: data.payUrl,
      qrCodeUrl: data.qrCodeUrl, // QR code string từ MoMo
      deeplink: data.deeplink, // Deep link để mở app MoMo
      orderId: orderId,
      amount: amount,
    };
  }

  async handleMomoIPN(data: any): Promise<void> {
    console.log('🔥 MoMo IPN received:', JSON.stringify(data, null, 2));

    // Verify signature
    const rawSignature = `accessKey=${this.ACCESS_KEY}&amount=${data.amount}&extraData=${data.extraData}&message=${data.message}&orderId=${data.orderId}&orderInfo=${data.orderInfo}&orderType=${data.orderType}&partnerCode=${this.PARTNER_CODE}&payType=${data.payType}&requestId=${data.requestId}&responseTime=${data.responseTime}&resultCode=${data.resultCode}&transId=${data.transId}`;

    const signature = crypto
      .createHmac('sha256', this.SECRET_KEY)
      .update(rawSignature)
      .digest('hex');

    if (signature !== data.signature) {
      console.error('❌ Invalid signature');
      throw new BadRequestException('Invalid signature');
    }

    const payment = await this.paymentModel.findOne({ orderId: data.orderId });
    if (!payment) {
      console.error('❌ Payment not found:', data.orderId);
      throw new BadRequestException('Payment not found');
    }

    // Kiểm tra xem đã xử lý chưa (tránh duplicate)
    if (payment.status === 'completed') {
      console.log('⚠️ Payment already processed:', data.orderId);
      return;
    }

    if (data.resultCode === 0) {
      // Thanh toán thành công
      payment.status = 'completed';
      payment.transactionId = data.transId;
      await payment.save();

      // Decode extraData và cộng coins
      const extraData = JSON.parse(
        Buffer.from(data.extraData, 'base64').toString(),
      );
      const coins = Math.floor(data.amount / 10); // 1,000đ = 100 coins

      const user = await this.userModel.findByIdAndUpdate(
        extraData.userId,
        { $inc: { wallet_coins: coins } },
        { new: true },
      );

      console.log(
        `✅ Payment ${data.orderId} completed. Added ${coins} coins to user ${extraData.userId}. New balance: ${user?.wallet_coins}`,
      );
    } else {
      // Thanh toán thất bại
      payment.status = 'failed';
      await payment.save();
      console.error('❌ Payment failed:', data.message);
    }
  }

  async handleMomoReturn(data: any) {
    console.log('🔄 MoMo Return:', JSON.stringify(data, null, 2));

    const payment = await this.paymentModel.findOne({ orderId: data.orderId });
    if (!payment) {
      return {
        success: false,
        message: 'Không tìm thấy giao dịch',
        amount: 0,
      };
    }

    //  Kiểm tra resultCode từ query params
    const success = parseInt(data.resultCode) === 0;

    return {
      success,
      message: success ? 'Nạp tiền thành công!' : 'Giao dịch thất bại',
      amount: payment.amount,
      status: payment.status,
    };
  }

  async getHistory(userId: string) {
    return await this.paymentModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
  }

  // Thêm method để check trạng thái payment
  async checkPaymentStatus(orderId: string) {
    const payment = await this.paymentModel.findOne({ orderId });
    return payment;
  }
}
