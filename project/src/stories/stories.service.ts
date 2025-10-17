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
  async findAll(skip = 0, limit = 20): Promise<Story[]> {
    return this.storyModel.find().skip(skip).limit(limit).exec();
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
