import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReadingHistoriesService } from './reading_histories.service';
import { ReadingHistoriesController } from './reading_histories.controller';
import {
  ReadingHistory,
  ReadingHistorySchema,
} from './schemas/reading_histories.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ReadingHistory.name, schema: ReadingHistorySchema },
    ]),
  ],
  controllers: [ReadingHistoriesController],
  providers: [ReadingHistoriesService],
})
export class ReadingHistoriesModule {}
