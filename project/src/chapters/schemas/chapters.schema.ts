import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Connection, Model } from 'mongoose';

export type ChapterDocument = Chapter & Document;

@Schema({ timestamps: true })
export class Chapter {
  @Prop({ required: true })
  storyId: string; // ✅ Keep as string since that's how your data is stored

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  number: number;

  @Prop()
  content: string;

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

  @Prop({ default: false })
  isHidden: boolean;
}

export const ChapterSchema = SchemaFactory.createForClass(Chapter);


ChapterSchema.post('save', async function (doc) {
  try {
    const conn: Connection = (this.constructor as any).db;
    const Story = conn.model('Story');

    // Count published, non-hidden chapters for this story
    const Chapter = conn.model('Chapter');
    const count = await Chapter.countDocuments({
      storyId: doc.storyId,
      status: 'published',
      isHidden: { $ne: true },
    });

    // Update story with new count
    await Story.updateOne(
      { _id: new Types.ObjectId(doc.storyId) },
      { $set: { chapterCount: count } },
    );

    console.log(`✅ Updated story ${doc.storyId} chapter count to ${count}`);
  } catch (error) {
    console.error('❌ Error updating chapter count:', error);
  }
});

/**
 * ✅ Update story chapter count after updating a chapter
 */
ChapterSchema.post('findOneAndUpdate', async function (doc) {
  if (!doc) return;

  try {
    const conn: Connection = (this.model as any).db;
    const Story = conn.model('Story');
    const Chapter = conn.model('Chapter');

    const count = await Chapter.countDocuments({
      storyId: doc.storyId,
      status: 'published',
      isHidden: { $ne: true },
    });

    await Story.updateOne(
      { _id: new Types.ObjectId(doc.storyId) },
      { $set: { chapterCount: count } },
    );

    console.log(`✅ Updated story ${doc.storyId} chapter count to ${count}`);
  } catch (error) {
    console.error('❌ Error updating chapter count:', error);
  }
});

/**
 * ✅ Update story chapter count after deleting a chapter
 */
ChapterSchema.pre('findOneAndDelete', async function (next) {
  const query = this.getQuery() as Record<string, unknown>;
  const chapterId = query['_id'] as string;

  if (!chapterId) return next();

  try {
    const model = this.model as Model<Chapter>;
    const conn: Connection = model.db as unknown as Connection;

    // Get the chapter to find its storyId
    const chapter = await model.findById(chapterId);
    if (chapter) {
      // Delete related data
      await Promise.all([
        conn
          .model('ReadingHistory')
          .deleteMany({ lastChapterId: chapterId })
          .exec(),
        conn.model('Report').deleteMany({ chapterId }).exec(),
      ]);

      // Update chapter count after deletion
      const Chapter = conn.model('Chapter');
      const count = await Chapter.countDocuments({
        storyId: chapter.storyId,
        status: 'published',
        isHidden: { $ne: true },
        _id: { $ne: chapterId }, // Exclude the one being deleted
      });

      const Story = conn.model('Story');
      await Story.updateOne(
        { _id: new Types.ObjectId(chapter.storyId) },
        { $set: { chapterCount: count } },
      );

      console.log(
        `✅ Updated story ${chapter.storyId} chapter count to ${count} after deletion`,
      );
    }
  } catch (error) {
    console.error('❌ Error in pre-delete hook:', error);
  }

  next();
});
