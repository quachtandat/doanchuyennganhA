import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Promotion extends Document {
  @Prop({ type: String, required: true, unique: true })
  code: string;

  @Prop()
  description: string;

  @Prop({ type: Number, required: true })
  bonusPercent: number;

  @Prop({ type: Date, required: true })
  validFrom: Date;

  @Prop({ type: Date, required: true })
  validTo: Date;

  @Prop({ enum: ['active', 'expired'], default: 'active' })
  status: string;
}

export const PromotionSchema = SchemaFactory.createForClass(Promotion);
