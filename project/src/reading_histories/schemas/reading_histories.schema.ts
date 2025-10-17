import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class ReadingHistory extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Story', required: true })
  storyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Chapter' })
  lastChapterId: Types.ObjectId;

  @Prop({ default: Date.now })
  lastReadAt: Date;

  @Prop({ type: Number, default: 0, min: 0, max: 100 })
  progress: number;

  @Prop({ type: Boolean, default: false })
  isFinished: boolean;
}

export const ReadingHistorySchema =
  SchemaFactory.createForClass(ReadingHistory);
