import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ViewController } from './view.controller';
import { Story, StorySchema } from '../src/stories/schemas/stories.schema';
import {
  Chapter,
  ChapterSchema,
} from '../src/chapters/schemas/chapters.schema';
import { User, UserSchema } from '../src/users/schemas/user.schema';
import {
  ReadingHistory,
  ReadingHistorySchema,
} from '../src/reading_histories/schemas/reading_histories.schema';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Story.name, schema: StorySchema },
      { name: Chapter.name, schema: ChapterSchema },
      { name: User.name, schema: UserSchema },
      { name: ReadingHistory.name, schema: ReadingHistorySchema },
    ]),
  ],
  controllers: [ViewController],
})
export class ViewModule {}
