import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Story, StorySchema } from '../stories/schemas/stories.schema';
import { Chapter, ChapterSchema } from '../chapters/schemas/chapters.schema';
import { ReadingHistory, ReadingHistorySchema } from '../reading_histories/schemas/reading_histories.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Story.name, schema: StorySchema },
      { name: Chapter.name, schema: ChapterSchema },
      { name: ReadingHistory.name, schema: ReadingHistorySchema },
    ]),
  ],
  controllers: [AdminController],
})
export class AdminModule {}


