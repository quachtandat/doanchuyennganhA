import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class WalletTransaction extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['topup', 'purchase', 'bonus', 'admin_adjust'],
  })
  type: string;

  @Prop({ required: true })
  amountCoins: number;

  @Prop({ required: true })
  balanceAfter: number;

  @Prop({ type: Types.ObjectId, ref: 'Payment' })
  relatedPaymentId?: Types.ObjectId;

  @Prop() note?: string;

  @Prop({ required: true, enum: ['pending', 'completed', 'failed'] })
  status: string;
}

export const WalletTransactionSchema =
  SchemaFactory.createForClass(WalletTransaction);
