/* eslint-disable prettier/prettier */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop()
  phone: string;

  @Prop({ required: true })
  password_hash: string;

  @Prop()
  salt: string;

  @Prop({ default: 'reader' })
  role: string;

  @Prop({ default: 0 })
  wallet_coins: number;

  @Prop({ default: 'active' })
  status: string;

  @Prop({ type: Object })
  author_info: {
    bio?: string;
    website?: string;
    social_links?: object;
  };
}

export const UserSchema = SchemaFactory.createForClass(User);
