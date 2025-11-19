import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ViewController } from './view.controller';
import { ViewService } from './view.service';
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
import { Purchase, PurchaseSchema } from '../src/purchases/schemas/purchases.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Story.name, schema: StorySchema },
      { name: Chapter.name, schema: ChapterSchema },
      { name: User.name, schema: UserSchema },
      { name: ReadingHistory.name, schema: ReadingHistorySchema },
      { name: Purchase.name, schema: PurchaseSchema },
    ]),
  ],
  controllers: [ViewController],
  providers: [ViewService],
})
export class ViewModule {}
