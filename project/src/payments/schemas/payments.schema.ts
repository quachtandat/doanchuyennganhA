import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Payment extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: ['momo', 'vnpay', 'bank', 'card'] })
  provider: string;

  @Prop({ required: true })
  amountVnd: number;

  @Prop({ required: true })
  coinsCredit: number;

  @Prop({ required: true })
  fee: number;

  @Prop({
    required: true,
    enum: ['pending', 'success', 'failed', 'chargeback'],
  })
  status: string;

  @Prop({ required: true, unique: true })
  txRef: string;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
