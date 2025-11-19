import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'settings' })
export class Setting extends Document {
  // ✅ Override _id (chỉ có 1 bản ghi global)
  @Prop({ type: String, required: true, default: 'global_settings' })
  declare _id: string;

  // ✅ moneyToCoin: có rate, minTopupVnd, bonusTiers
  @Prop({
    type: {
      rate: { type: Number, required: true }, // double
      minTopupVnd: { type: Number, required: true }, // int
      bonusTiers: {
        type: [
          {
            minAmount: { type: Number, required: true },
            bonusPercent: { type: Number, required: true },
          },
        ],
        default: [],
      },
    },
    required: true,
  })
  moneyToCoin: {
    rate: number;
    minTopupVnd: number;
    bonusTiers: { minAmount: number; bonusPercent: number }[];
  };

  @Prop({ type: Number, required: true })
  authorRevenueSharePercent: number;

  @Prop({ type: Number, required: true })
  platformFeePercent: number;
}

export const SettingSchema = SchemaFactory.createForClass(Setting);
