import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RatingsService } from './ratings.service';
import { RatingsController } from './ratings.controller';
import { Rating, RatingSchema } from './schemas/rating.schema';
import { Story, StorySchema } from '../stories/schemas/stories.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Rating.name, schema: RatingSchema }, { name: Story.name, schema: StorySchema }])],
  providers: [RatingsService],
  controllers: [RatingsController],
  exports: [RatingsService],
})
export class RatingsModule {}
