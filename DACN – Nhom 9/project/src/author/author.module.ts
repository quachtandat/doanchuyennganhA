import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthorController } from './author.controller';
import { Story, StorySchema } from '../stories/schemas/stories.schema';
import { Chapter, ChapterSchema } from '../chapters/schemas/chapters.schema';
import { Comment, CommentSchema } from '../comments/schemas/comment.schema';
import { ReadingHistory, ReadingHistorySchema } from '../reading_histories/schemas/reading_histories.schema';
import { Purchase, PurchaseSchema } from '../purchases/schemas/purchases.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Story.name, schema: StorySchema },
      { name: Chapter.name, schema: ChapterSchema },
      { name: Comment.name, schema: CommentSchema },
      { name: ReadingHistory.name, schema: ReadingHistorySchema },
      { name: Purchase.name, schema: PurchaseSchema },
    ]),
  ],
  controllers: [AuthorController],
})
export class AuthorModule {}


