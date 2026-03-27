import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Rating, RatingDocument } from './schemas/rating.schema';
import { Story, StoryDocument } from '../stories/schemas/stories.schema';

@Injectable()
export class RatingsService {
  constructor(
    @InjectModel(Rating.name) private readonly ratingModel: Model<RatingDocument>,
    @InjectModel(Story.name) private readonly storyModel: Model<StoryDocument>,
  ) {}

  /**
   * Submit or update a user's rating for a story. Returns current aggregate { average, count }
   */
  async submitRating(storyId: string, userId: string, rating: number) {
    if (!Types.ObjectId.isValid(storyId)) throw new BadRequestException('Invalid story id');
    if (!Types.ObjectId.isValid(userId)) throw new BadRequestException('Invalid user id');

    // upsert user's rating for this story
    await this.ratingModel.findOneAndUpdate(
      { storyId: new Types.ObjectId(storyId), userId: new Types.ObjectId(userId) },
      { $set: { rating } },
      { upsert: true, new: true },
    );

    // recompute aggregate for the story
    const agg = await this.ratingModel.aggregate([
      { $match: { storyId: new Types.ObjectId(storyId) } },
      { $group: { _id: '$storyId', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);

    const data = agg && agg[0] ? { average: Number(agg[0].avg || 0), count: agg[0].count || 0 } : { average: 0, count: 0 };

    // store aggregate on story (normalize to 0..5)
    await this.storyModel.findByIdAndUpdate(storyId, { ratingAverage: data.average, ratingCount: data.count }, { new: true }).exec();

    return data;
  }

  /**
   * Return the given user's rating for a story plus aggregate
   */
  async getUserRating(storyId: string, userId: string) {
    if (!Types.ObjectId.isValid(storyId)) throw new BadRequestException('Invalid story id');
    if (!Types.ObjectId.isValid(userId)) throw new BadRequestException('Invalid user id');

    const my = await this.ratingModel.findOne({ storyId: new Types.ObjectId(storyId), userId: new Types.ObjectId(userId) }).lean();

    const agg = await this.ratingModel.aggregate([
      { $match: { storyId: new Types.ObjectId(storyId) } },
      { $group: { _id: '$storyId', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);

    const data = agg && agg[0] ? { average: Number(agg[0].avg || 0), count: agg[0].count || 0 } : { average: 0, count: 0 };

    return { myRating: my ? my.rating : null, average: data.average, count: data.count };
  }
}
