import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Comment extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Story', required: true })
  storyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Chapter', required: false })
  chapterId?: Types.ObjectId;

  @Prop({ required: true })
  content: string;

  @Prop({ default: false })
  isHidden: boolean;

  @Prop({
    type: [
      {
        _id: false,
        content: String,
        authorId: String,
        authorName: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  replies?: Array<{
    content: string;
    authorId: string;
    authorName: string;
    createdAt: Date;
  }>;
}

export type CommentDocument = Comment & Document;
export const CommentSchema = SchemaFactory.createForClass(Comment);


