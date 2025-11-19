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

@Injectable()
export class StoriesService {
  constructor(
    @InjectModel(Story.name)
    private readonly storyModel: Model<StoryDocument>,
  ) {}

  // 🟢 Create
  async create(dto: CreateStoryDto): Promise<Story> {
    // Kiểm tra trùng slug
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

  // 🟣 Get by ID
  async findOne(id: string): Promise<Story> {
    const story = await this.storyModel.findById(id).exec();
    if (!story) throw new NotFoundException('Story not found');
    return story;
  }

  // 🟠 Update
  async update(id: string, dto: UpdateStoryDto): Promise<Story> {
    const story = await this.storyModel.findByIdAndUpdate(id, dto, {
      new: true,
    });
    if (!story) throw new NotFoundException('Story not found');
    return story;
  }

  // 🔴 Delete
  async remove(id: string): Promise<Story> {
    const story = await this.storyModel.findByIdAndDelete(id);
    if (!story) throw new NotFoundException('Story not found');
    return story;
  }
}
