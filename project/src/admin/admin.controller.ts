import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Story, StoryDocument } from '../stories/schemas/stories.schema';
import { Chapter, ChapterDocument } from '../chapters/schemas/chapters.schema';
import { ReadingHistory } from '../reading_histories/schemas/reading_histories.schema';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Story.name) private readonly storyModel: Model<StoryDocument>,
    @InjectModel(Chapter.name)
    private readonly chapterModel: Model<ChapterDocument>,
    @InjectModel('ReadingHistory')
    private readonly readingHistoryModel: Model<ReadingHistory>,
  ) {}

  @Get('dashboard')
  async dashboard() {
    const [totalUsers, totalAuthors, totalStories, totalChapters, totalReads] =
      await Promise.all([
        this.userModel.countDocuments({}),
        this.userModel.countDocuments({ role: 'author' }),
        this.storyModel.countDocuments({}),
        this.chapterModel.countDocuments({}),
        this.readingHistoryModel.countDocuments({}),
      ]);

    return {
      totalUsers,
      totalAuthors,
      totalStories,
      totalChapters,
      totalReads,
    };
  }
}


