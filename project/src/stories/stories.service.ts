import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Story, StoryDocument } from './schemas/stories.schema';
import { CreateStoryDto } from './dto/create-story.dto';
import { UpdateStoryDto } from './dto/update-story.dto';

// THÊM INTERFACE
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
  ) {}

  // Create
  async create(dto: CreateStoryDto): Promise<Story> {
    const exists = await this.storyModel.findOne({ slug: dto.slug });
    if (exists) {
      throw new ConflictException('Slug already exists');
    }

    const story = new this.storyModel(dto);
    return story.save();
  }

  // 🟡 Get all
  async findAll(
    skip = 0,
    limit = 20,
    filter: Partial<Story> = {},
    populateAuthor = false,
    authorName?: string,
  ): Promise<Story[]> {
    // If authorName provided, perform aggregation lookup to users and match by author_info.display_name or name
    if (authorName && authorName.trim()) {
      const pipeline: any[] = [];
      if (filter && Object.keys(filter).length > 0) pipeline.push({ $match: filter as any });
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
            { 'author.author_info.display_name': { $regex: authorName.trim(), $options: 'i' } },
            { 'author.name': { $regex: authorName.trim(), $options: 'i' } },
          ],
        },
      });
      if (populateAuthor) {
        // project to include author info
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

    const q = this.storyModel.find(filter as any).skip(skip).limit(limit);
    if (populateAuthor) {
      q.populate({ path: 'authorId', select: 'name author_info' });
    }
    return q.exec();
  }

  // THÊM METHOD NÀY - Advanced filter với aggregation
  async filterStories(options: FilterOptions) {
    const { sortBy, order, status, page, limit } = options;
    const skip = (page - 1) * limit;

    // Build aggregation pipeline
    const pipeline: any[] = [
      // Step 1: Lookup chapters
      {
        $lookup: {
          from: 'chapters',
          localField: '_id',
          foreignField: 'storyId',
          as: 'chapters',
        },
      },

      // Step 2: Lookup reading histories
      {
        $lookup: {
          from: 'readinghistories',
          localField: '_id',
          foreignField: 'storyId',
          as: 'readingHistories',
        },
      },

      // Step 3: Add computed fields
      {
        $addFields: {
          chapterCount: { $size: '$chapters' },
          totalReads: { $size: '$readingHistories' },

          // Compute story status
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
                          { $size: '$chapters' },
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

          // Last chapter update time
          lastChapterUpdate: {
            $max: '$chapters.createdAt',
          },
        },
      },

      // Step 4: Match by status (if not 'all')
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
                chapters: 0,
                readingHistories: 0,
              },
            },
          ],
        },
      },
    ];

    const result = await this.storyModel.aggregate(pipeline);

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

  // THÊM HELPER METHOD
  private getSortStage(sortBy: string, order: string) {
    const sortOrder = order === 'asc' ? 1 : -1;

    const sortMap: Record<string, any> = {
      lastUpdated: { lastChapterUpdate: sortOrder, updatedAt: sortOrder },
      chapters: { chapterCount: sortOrder },
      readers: { totalReads: sortOrder },
      title: { title: sortOrder },
      rating: { rating: sortOrder },
      reviews: { reviewCount: sortOrder },
      rank: { totalReads: sortOrder, chapterCount: sortOrder },
      frequency: { lastChapterUpdate: sortOrder },
    };

    return sortMap[sortBy] || sortMap.lastUpdated;
  }

  // Get by ID
  async findOne(id: string): Promise<Story> {
    const story = await this.storyModel.findById(id).exec();
    if (!story) throw new NotFoundException('Story not found');
    return story;
  }

  // Update
  async update(id: string, dto: UpdateStoryDto): Promise<Story> {
    const story = await this.storyModel.findByIdAndUpdate(id, dto, {
      new: true,
    });
    if (!story) throw new NotFoundException('Story not found');
    return story;
  }

  // Delete
  async remove(id: string): Promise<Story> {
    const story = await this.storyModel.findByIdAndDelete(id);
    if (!story) throw new NotFoundException('Story not found');
    return story;
  }
}
