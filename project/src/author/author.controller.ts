import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Story, StoryDocument } from '../stories/schemas/stories.schema';
import { Chapter, ChapterDocument } from '../chapters/schemas/chapters.schema';
import { Comment, CommentDocument } from '../comments/schemas/comment.schema';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('author')
@Controller('author')
export class AuthorController {
  constructor(
    @InjectModel(Story.name) private readonly storyModel: Model<StoryDocument>,
    @InjectModel(Chapter.name)
    private readonly chapterModel: Model<ChapterDocument>,
    @InjectModel(Comment.name)
    private readonly commentModel: Model<CommentDocument>,
  ) {}

  // Stories
  @Post('stories')
  async createStory(@Request() req, @Body() body: any) {
    const authorId = new Types.ObjectId(req.user.userId);
    const story = new this.storyModel({
      title: body.title,
      slug: body.slug,
      authorId,
      category: body.category ?? [],
      coverUrl: body.coverUrl,
      description: body.description,
      status: 'pending',
    });
    return story.save();
  }

  @Put('stories/:id')
  async updateStory(@Request() req, @Param('id') id: string, @Body() body: any) {
    const story = await this.storyModel.findById(id);
    if (!story) throw new BadRequestException('Story not found');
    if (String(story.authorId) !== req.user.userId) {
      throw new BadRequestException('Not your story');
    }
    Object.assign(story, {
      title: body.title ?? story.title,
      slug: body.slug ?? story.slug,
      category: body.category ?? story.category,
      coverUrl: body.coverUrl ?? story.coverUrl,
      description: body.description ?? story.description,
    });
    return story.save();
  }

  @Delete('stories/:id')
  async deleteStory(@Request() req, @Param('id') id: string) {
    const story = await this.storyModel.findById(id);
    if (!story) throw new BadRequestException('Story not found');
    if (String(story.authorId) !== req.user.userId) {
      throw new BadRequestException('Not your story');
    }
    await this.storyModel.findByIdAndDelete(id);
    return { success: true };
  }

  // Chapters
  @Post('chapters')
  async createChapter(@Request() req, @Body() body: any) {
    const story = await this.storyModel.findById(body.storyId);
    if (!story) throw new BadRequestException('Story not found');
    if (String(story.authorId) !== req.user.userId) {
      throw new BadRequestException('Not your story');
    }
    const chapter = new this.chapterModel({
      storyId: story._id,
      title: body.title,
      number: body.number,
      content: body.content,
      isVip: !!body.isVip,
      priceCoins: body.priceCoins ?? 0,
      status: 'draft',
    });
    return chapter.save();
  }

  @Put('chapters/:id')
  async updateChapter(@Request() req, @Param('id') id: string, @Body() body: any) {
    const chapter = await this.chapterModel.findById(id);
    if (!chapter) throw new BadRequestException('Chapter not found');
    const story = await this.storyModel.findById(chapter.storyId);
    if (!story || String(story.authorId) !== req.user.userId) {
      throw new BadRequestException('Not your story');
    }
    Object.assign(chapter, {
      title: body.title ?? chapter.title,
      number: body.number ?? chapter.number,
      content: body.content ?? chapter.content,
      isVip: body.isVip ?? chapter.isVip,
      priceCoins: body.priceCoins ?? chapter.priceCoins,
      status: body.status ?? chapter.status,
    });
    return chapter.save();
  }

  @Delete('chapters/:id')
  async deleteChapter(@Request() req, @Param('id') id: string) {
    const chapter = await this.chapterModel.findById(id);
    if (!chapter) throw new BadRequestException('Chapter not found');
    const story = await this.storyModel.findById(chapter.storyId);
    if (!story || String(story.authorId) !== req.user.userId) {
      throw new BadRequestException('Not your story');
    }
    await this.chapterModel.findByIdAndDelete(id);
    return { success: true };
  }

  // Author: xem bình luận trên các truyện của mình
  @Get('comments')
  async myComments(@Request() req) {
    // Use injected commentModel to perform aggregation (ensures schema is registered)
    const comments = await this.commentModel.aggregate([
      { $lookup: { from: 'stories', localField: 'storyId', foreignField: '_id', as: 'story' } },
      { $unwind: '$story' },
  { $match: { $or: [ { 'story.authorId': new Types.ObjectId(req.user.userId) }, { 'story.authorId': req.user.userId } ] } },
      // Join chapter (may be null)
      { $lookup: { from: 'chapters', localField: 'chapterId', foreignField: '_id', as: 'chapter' } },
      { $unwind: { path: '$chapter', preserveNullAndEmptyArrays: true } },
      // Join user to get commenter name
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $sort: { createdAt: -1 } },
      {
        $project: {
          _id: 1,
          content: 1,
          storyId: 1,
          chapterId: 1,
          createdAt: 1,
          isHidden: 1,
          storyTitle: '$story.title',
          chapterTitle: '$chapter.title',
          userName: '$user.name',
        },
      },
    ]).exec();

    return comments;
  }
}


