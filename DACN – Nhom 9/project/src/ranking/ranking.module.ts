import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RankingController } from './ranking.controller';
import { RankingService } from './ranking.service';
import { Story, StorySchema } from '../stories/schemas/stories.schema';
import {
  ReadingHistory,
  ReadingHistorySchema,
} from '../reading_histories/schemas/reading_histories.schema'; // ✅ Import

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Story.name, schema: StorySchema },
      { name: ReadingHistory.name, schema: ReadingHistorySchema }, // ✅ Thêm
    ]),
  ],
  controllers: [RankingController],
  providers: [RankingService],
  exports: [RankingService],
})
export class RankingModule {}
