import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ unique: true, sparse: true })
  email?: string;

  @Prop()
  phone?: string;

  @Prop()
  password_hash?: string;

  @Prop({ default: 'reader', enum: ['reader', 'author', 'admin'] })
  role: string;

  @Prop({ default: 0 })
  wallet_coins: number;

  @Prop({ default: 'active', enum: ['active', 'blocked', 'pending'] })
  status: string;

  @Prop({ required: true })
  salt: string;

  @Prop({
    type: {
      display_name: { type: String, required: false, default: '' },
      verified: { type: Boolean, default: false },
    },
    default: () => ({ display_name: '', verified: false }),
  })
  author_info: {
    display_name: string;
    verified: boolean;
  };
}
export type UserDocument = User & Document;

export const UserSchema = SchemaFactory.createForClass(User);
