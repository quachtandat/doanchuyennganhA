import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Connection, Model } from 'mongoose';

export type StoryDocument = Story & Document;

@Schema({ timestamps: true })
export class Story {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true, unique: true })
  slug: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  authorId: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  category: string[];

  @Prop()
  coverUrl: string;

  @Prop()
  description: string;

  @Prop({
    type: String,
    enum: ['pending', 'published', 'rejected'],
    default: 'pending',
  })
  status: string;
}

export const StorySchema = SchemaFactory.createForClass(Story);
/**
 * 🧹 Hook cascade delete
 */

StorySchema.pre('findOneAndDelete', async function (next) {
  const query = this.getQuery() as Record<string, unknown>;
  const storyId = query['_id'] as string;

  // ✅ ép kiểu rõ ràng, không còn "any"
  const model = this.model as Model<Story>;
  const conn: Connection = model.db as unknown as Connection;

  await Promise.all([
    conn.model('Chapter').deleteMany({ storyId }),
    conn.model('Purchase').deleteMany({ storyId }),
    conn.model('ReadingHistory').deleteMany({ storyId }),
    conn.model('Report').deleteMany({ storyId }),
  ]);

  next();
});
