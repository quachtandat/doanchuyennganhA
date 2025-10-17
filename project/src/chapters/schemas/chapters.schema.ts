import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Connection, Model } from 'mongoose';

export type ChapterDocument = Chapter & Document;

@Schema({ timestamps: true })
export class Chapter {
  @Prop({ type: Types.ObjectId, ref: 'Story', required: true })
  storyId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  number: number;

  @Prop()
  content: string; // có thể là text hoặc URL

  @Prop({ default: false })
  isVip: boolean;

  @Prop({ default: 0 })
  priceCoins: number;

  @Prop({
    type: String,
    enum: ['draft', 'published', 'removed'],
    default: 'draft',
  })
  status: string;
}

export const ChapterSchema = SchemaFactory.createForClass(Chapter);

ChapterSchema.pre('findOneAndDelete', async function (next) {
  const query = this.getQuery() as Record<string, unknown>;
  const chapterId = query['_id'] as string;

  if (!chapterId) return next();

  // ✅ Lấy model hiện tại với type an toàn
  const model = this.model as Model<Chapter>;
  const conn: Connection = model.db as unknown as Connection;

  // ✅ Xoá cascade dữ liệu liên quan
  await Promise.all([
    conn
      .model('ReadingHistory')
      .deleteMany({ lastChapterId: chapterId })
      .exec(),
    conn.model('Report').deleteMany({ chapterId }).exec(),
  ]);

  next();
});
