import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RatingDocument = Rating & Document;

@Schema({ timestamps: true })
export class Rating {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Story', required: true })
  storyId: Types.ObjectId;

  @Prop({ required: true })
  rating: number;
}

export const RatingSchema = SchemaFactory.createForClass(Rating);
