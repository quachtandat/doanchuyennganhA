import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class AuthorRequest extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: false, default: '' })
  message?: string;

  @Prop({
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  })
  status: string;

  @Prop({ required: false })
  adminNote?: string;
}

export type AuthorRequestDocument = AuthorRequest & Document;

export const AuthorRequestSchema = SchemaFactory.createForClass(AuthorRequest);


