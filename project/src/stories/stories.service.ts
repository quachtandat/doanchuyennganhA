import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Story, StoryDocument } from './schemas/stories.schema';
import { Chapter, ChapterDocument } from '../chapters/schemas/chapters.schema';
import { CreateStoryDto } from './dto/create-story.dto';
import { UpdateStoryDto } from './dto/update-story.dto';

interface FilterOptions {
  sortBy: string;
  order: string;
  status: string;
  page: number;
  limit: number;
}

@Injectable()
export class StoriesService {
  constructor(
    @InjectModel(Story.name)
    private readonly storyModel: Model<StoryDocument>,
    @InjectModel(Chapter.name)
    private readonly chapterModel: Model<ChapterDocument>,
  ) {}

  async create(dto: CreateStoryDto): Promise<Story> {
    const exists = await this.storyModel.findOne({ slug: dto.slug });
    if (exists) {
      throw new ConflictException('Slug already exists');
    }
    const story = new this.storyModel(dto);
    return story.save();
  }

  async findAll(
    skip = 0,
    limit = 20,
    filter: Partial<Story> = {},
    populateAuthor = false,
    authorName?: string,
  ): Promise<Story[]> {
    if (authorName && authorName.trim()) {
      const pipeline: any[] = [];
      if (filter && Object.keys(filter).length > 0)
        pipeline.push({ $match: filter as any });
      pipeline.push({
        $lookup: {
          from: 'users',
          localField: 'authorId',
          foreignField: '_id',
          as: 'author',
        },
      });
      pipeline.push({ $unwind: '$author' });
      pipeline.push({
        $match: {
          $or: [
            {
              'author.author_info.display_name': {
                $regex: authorName.trim(),
                $options: 'i',
              },
            },
            { 'author.name': { $regex: authorName.trim(), $options: 'i' } },
          ],
        },
      });
      if (populateAuthor) {
        pipeline.push({
          $project: {
            title: 1,
            slug: 1,
            status: 1,
            isHidden: 1,
            authorId: '$author',
          },
        });
      }
      pipeline.push({ $skip: Number(skip) });
      pipeline.push({ $limit: Number(limit) });
      return this.storyModel.aggregate(pipeline).exec() as any;
    }

    const q = this.storyModel
      .find(filter as any)
      .skip(skip)
      .limit(limit);
    if (populateAuthor) {
      q.populate({ path: 'authorId', select: 'name author_info' });
    }
    return q.exec();
  }

  async filterStories(options: FilterOptions) {
    const { sortBy, order, status, page, limit } = options;
    const skip = (page - 1) * limit;

    // ✅ Vietnamese collation for proper sorting
    const collationOptions = {
      locale: 'vi',
      strength: 1, // Case insensitive, ignore accents for primary sorting
    };

    // ✅ FIXED: Don't overwrite chapterCount, just use the stored value
    const pipeline: any[] = [
      // Step 1: Convert story _id (ObjectId) to string for matching
      {
        $addFields: {
          storyIdAsString: { $toString: '$_id' },
        },
      },

      // Step 2: Lookup reading histories for totalReads
      {
        $lookup: {
          from: 'readinghistories',
          localField: '_id',
          foreignField: 'storyId',
          as: 'readingHistories',
        },
      },

      // Step 3: Add computed fields (use existing chapterCount!)
      {
        $addFields: {
          // ✅ USE STORED chapterCount instead of computing from chapters array
          // chapterCount already exists in the document, no need to overwrite it

          totalReads: { $size: '$readingHistories' },

          computedStatus: {
            $cond: {
              if: { $eq: ['$status', 'pending'] },
              then: 'hiatus',
              else: {
                $cond: {
                  if: {
                    $and: [
                      { $ne: ['$expectedTotalChapters', null] },
                      {
                        $gte: [
                          '$chapterCount', // ✅ Use stored value
                          '$expectedTotalChapters',
                        ],
                      },
                    ],
                  },
                  then: 'completed',
                  else: 'ongoing',
                },
              },
            },
          },
        },
      },

      // Step 4: Filter by status if needed
      ...(status !== 'all' ? [{ $match: { computedStatus: status } }] : []),

      // Step 5: Sort
      {
        $sort: this.getSortStage(sortBy, order),
      },

      // Step 6: Facet for pagination
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                storyIdAsString: 0, // Remove temp field
                readingHistories: 0, // Remove joined data
                // ✅ Keep chapterCount in the response!
              },
            },
          ],
        },
      },
    ];

    // ✅ Apply Vietnamese collation to the aggregation
    const result = await this.storyModel
      .aggregate(pipeline)
      .collation(collationOptions);

    const total = result[0]?.metadata[0]?.total || 0;
    const stories = result[0]?.data || [];

    return {
      success: true,
      stories,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private getSortStage(sortBy: string, order: string) {
    const sortOrder = order === 'asc' ? 1 : -1;

    const sortMap: Record<string, any> = {
      lastUpdated: {
        updatedAt: sortOrder,
      },
      chapters: {
        chapterCount: sortOrder, // ✅ Sort by stored chapterCount
      },
      readers: {
        totalReads: sortOrder,
      },
      title: {
        title: sortOrder,
      },
      rating: {
        ratingAverage: sortOrder,
        ratingCount: sortOrder,
      },
    };

    return sortMap[sortBy] || sortMap.lastUpdated;
  }

  async findOne(id: string): Promise<Story> {
    const story = await this.storyModel.findById(id).exec();
    if (!story) throw new NotFoundException('Story not found');
    return story;
  }

  async update(id: string, dto: UpdateStoryDto): Promise<Story> {
    const story = await this.storyModel.findByIdAndUpdate(id, dto, {
      new: true,
    });
    if (!story) throw new NotFoundException('Story not found');
    return story;
  }

  async remove(id: string): Promise<Story> {
    const story = await this.storyModel.findByIdAndDelete(id);
    if (!story) throw new NotFoundException('Story not found');
    return story;
  }
}
