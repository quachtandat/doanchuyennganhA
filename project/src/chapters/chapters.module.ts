import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChaptersService } from './chapters.service';
import { ChaptersController } from './chapters.controller';
import { Chapter, ChapterSchema } from './schemas/chapters.schema';
import { Story, StorySchema } from '../stories/schemas/stories.schema';
import {
  Purchase,
  PurchaseSchema,
} from '../purchases/schemas/purchases.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Chapter.name, schema: ChapterSchema },
      { name: Story.name, schema: StorySchema },
      { name: Purchase.name, schema: PurchaseSchema },
    ]),
  ],
  controllers: [ChaptersController],
  providers: [ChaptersService],
  exports: [ChaptersService],
})
export class ChaptersModule {}
