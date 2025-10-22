import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PurchaseDocument = Purchase & Document;

@Schema({ timestamps: false })
export class Purchase extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Chapter', required: true })
  chapterId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Story', required: true })
  storyId: Types.ObjectId;

  @Prop({ required: true })
  priceCoins: number;

  @Prop({
    type: String,
    enum: ['wallet', 'promo', 'gift'],
    default: 'wallet',
  })
  method: string;

  @Prop({
    type: String,
    enum: ['completed', 'refunded'],
    default: 'completed',
  })
  status: string;

  @Prop({ default: Date.now })
  purchaseAt: Date;
}

export const PurchaseSchema = SchemaFactory.createForClass(Purchase);
