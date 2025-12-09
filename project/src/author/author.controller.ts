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
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Story, StoryDocument } from '../stories/schemas/stories.schema';
import { Chapter, ChapterDocument } from '../chapters/schemas/chapters.schema';
import { Comment, CommentDocument } from '../comments/schemas/comment.schema';
import { ReadingHistory } from '../reading_histories/schemas/reading_histories.schema';
import { Purchase } from '../purchases/schemas/purchases.schema';

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
    @InjectModel(ReadingHistory.name)
    private readonly readingHistoryModel: Model<ReadingHistory>,
    @InjectModel(Purchase.name)
    private readonly purchaseModel: Model<Purchase>,
  ) {}

  // Author overview: counts and revenue (VND)
  @Get('overview')
  async overview(@Request() req) {
    const authorIdStr = req.user.userId;
    let authorOid: Types.ObjectId | null = null;
    try { authorOid = new Types.ObjectId(authorIdStr); } catch (e) { authorOid = null; }
    const authorFilter = authorOid ? { $or: [ { authorId: authorOid }, { authorId: authorIdStr } ] } : { authorId: authorIdStr };

    // find stories by author (handle both ObjectId and string-stored authorId)
    const stories = await this.storyModel.find(authorFilter).select('_id').lean();
    const storyIds = stories.map((s) => s._id);

    if (storyIds.length === 0) {
      return { stories: 0, chapters: 0, reads: 0, coins: 0, revenueVnd: 0 };
    }

    const storiesCount = await this.storyModel.countDocuments(authorFilter);
    const chaptersCount = await this.chapterModel.countDocuments({ storyId: { $in: storyIds } });

    const readsCount = await this.readingHistoryModel.countDocuments({ storyId: { $in: storyIds } });

    // Sum coins from purchases (completed) for the author's stories
    const revenueAgg = await this.purchaseModel.aggregate([
      { $match: { storyId: { $in: storyIds }, status: 'completed' } },
      { $group: { _id: null, totalCoins: { $sum: '$priceCoins' } } },
    ]);
    const totalCoins = (revenueAgg[0] && revenueAgg[0].totalCoins) || 0;
    // Conversion: 1 coin = 10 VND (100 coins = 1000 VND)
    const revenueVnd = totalCoins * 10;

    return {
      stories: storiesCount,
      chapters: chaptersCount,
      reads: readsCount,
      coins: totalCoins,
      revenueVnd,
    };
  }

  // Reading stats (daily) for last 30 days for this author's stories
  @Get('reading-stats-daily')
  async readingStatsDaily(@Request() req) {
    const authorIdStr = req.user.userId;
    let authorOid: Types.ObjectId | null = null;
    try { authorOid = new Types.ObjectId(authorIdStr); } catch (e) { authorOid = null; }
    const authorFilter = authorOid ? { $or: [ { authorId: authorOid }, { authorId: authorIdStr } ] } : { authorId: authorIdStr };

    const stories = await this.storyModel.find(authorFilter).select('_id').lean();
    const storyIds = stories.map((s) => s._id);

    if (storyIds.length === 0) return { data: [] };

    const thirtyAgo = new Date();
    thirtyAgo.setDate(thirtyAgo.getDate() - 29);

    const stats = await this.readingHistoryModel.aggregate([
      { $match: { storyId: { $in: storyIds }, lastReadAt: { $gte: thirtyAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$lastReadAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return { data: stats };
  }

  // Revenue by month (last 12 months) for author's stories, returns VND
  @Get('revenue-stats-monthly')
  async revenueStatsMonthly(@Request() req) {
    const authorIdStr = req.user.userId;
    let authorOid: Types.ObjectId | null = null;
    try { authorOid = new Types.ObjectId(authorIdStr); } catch (e) { authorOid = null; }
    const authorFilter = authorOid ? { $or: [ { authorId: authorOid }, { authorId: authorIdStr } ] } : { authorId: authorIdStr };

    const stories = await this.storyModel.find(authorFilter).select('_id').lean();
    const storyIds = stories.map((s) => s._id);

    if (storyIds.length === 0) return { data: [] };

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);

    const stats = await this.purchaseModel.aggregate([
      { $match: { storyId: { $in: storyIds }, status: 'completed', purchaseAt: { $gte: twelveMonthsAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$purchaseAt' } },
          totalCoins: { $sum: '$priceCoins' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // convert coins to VND
    const converted = stats.map((s) => ({ _id: s._id, total: (s.totalCoins || 0) * 10 }));
    return { data: converted };
  }

  // Top stories by reads for this author
  @Get('top-stories')
  async topStories(@Request() req, @Query('limit') limit = '5') {
    const authorIdStr = req.user.userId;
    let authorOid: Types.ObjectId | null = null;
    try { authorOid = new Types.ObjectId(authorIdStr); } catch (e) { authorOid = null; }
    const authorFilter = authorOid ? { $or: [ { authorId: authorOid }, { authorId: authorIdStr } ] } : { authorId: authorIdStr };
    const l = Math.max(1, Math.min(50, parseInt(limit, 10) || 5));

    const stories = await this.storyModel.find(authorFilter).select('_id').lean();
    const storyIds = stories.map((s) => s._id);

    if (storyIds.length === 0) {
      return { data: [] };
    }

    const stats = await this.readingHistoryModel.aggregate([
      { $match: { storyId: { $in: storyIds } } },
      { $group: { _id: '$storyId', reads: { $sum: 1 } } },
      { $sort: { reads: -1 } },
      { $limit: l },
      {
        $lookup: {
          from: 'stories',
          localField: '_id',
          foreignField: '_id',
          as: 'story',
        },
      },
      { $unwind: '$story' },
      {
        $lookup: {
          from: 'chapters',
          let: { sid: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: [{ $toString: '$storyId' }, { $toString: '$$sid' }] } } },
            { $count: 'count' },
          ],
          as: 'chapters',
        },
      },
      {
        $lookup: {
          from: 'purchases',
          let: { sid: '$_id' },
          pipeline: [
            { $match: { $expr: { $and: [ { $eq: ['$storyId', '$$sid'] }, { $eq: ['$status', 'completed'] } ] } } },
            { $group: { _id: null, totalCoins: { $sum: '$priceCoins' } } },
          ],
          as: 'purchases',
        },
      },
      {
        $project: {
          storyId: '$_id',
          title: '$story.title',
          reads: 1,
          chaptersCount: { $ifNull: [ { $arrayElemAt: ['$chapters.count', 0] }, 0 ] },
          totalCoins: { $ifNull: [ { $arrayElemAt: ['$purchases.totalCoins', 0] }, 0 ] },
        },
      },
    ]);

    // convert coins to VND (1 coin = 10 VND)
    const out = stats.map((s) => ({
      storyId: s.storyId,
      title: s.title,
      reads: s.reads || 0,
      chapters: s.chaptersCount || 0,
      revenueVnd: (s.totalCoins || 0) * 10,
    }));

    return { data: out };
  }

  // Get all stories for this author
  @Get('stories')
  async getAuthorStories(
    @Request() req,
    @Query('sort') sort = 'createdAt',
    @Query('order') order = 'desc',
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const authorIdStr = req.user.userId;
    let authorOid: Types.ObjectId | null = null;
    try { authorOid = new Types.ObjectId(authorIdStr); } catch (e) { authorOid = null; }
    const authorFilter = authorOid ? { $or: [ { authorId: authorOid }, { authorId: authorIdStr } ] } : { authorId: authorIdStr };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const orderNum = order === 'asc' ? 1 : -1;
    const sortObj: any = { [sort]: orderNum };

    const stories = await this.storyModel
      .find(authorFilter)
      .sort(sortObj as any)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Fetch chapter count and reading count for each story
    const storiesWithStats = await Promise.all(
      stories.map(async (story) => {
        const chapterCount = await this.chapterModel.countDocuments({ storyId: story._id });
        const readCount = await this.readingHistoryModel.countDocuments({ storyId: story._id });
        return {
          ...story,
          chapterCount,
          readCount,
        };
      }),
    );

    const total = await this.storyModel.countDocuments(authorFilter);

    return {
      data: storiesWithStats,
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum),
    };
  }

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

  // Chapters - Get author's chapters
  @Get('chapters')
  async getAuthorChapters(@Request() req, @Query('sort') sort = 'createdAt', @Query('order') order = 'desc') {
    const authorIdStr = req.user.userId;
    let authorOid: Types.ObjectId | null = null;
    try { authorOid = new Types.ObjectId(authorIdStr); } catch (e) { authorOid = null; }
    const authorFilter = authorOid ? { $or: [ { authorId: authorOid }, { authorId: authorIdStr } ] } : { authorId: authorIdStr };

    // Get author's stories
    const stories = await this.storyModel.find(authorFilter).lean();
    const storyMap = new Map(stories.map(s => [String(s._id), s]));
    const storyIds = Array.from(storyMap.keys());

    if (storyIds.length === 0) {
      return { data: [] };
    }

    // Get chapters for these stories
    const sortObj: any = {};
    sortObj[sort] = order === 'asc' ? 1 : -1;

    const chapters = await this.chapterModel
      .find({ storyId: { $in: storyIds } })
      .sort(sortObj)
      .lean();

    // Add story title and read count to each chapter
    const data = await Promise.all(
      chapters.map(async (ch) => {
        const readCount = await this.readingHistoryModel.countDocuments({ lastChapterId: ch._id });
        return {
          ...ch,
          storyTitle: storyMap.get(String(ch.storyId))?.title || 'N/A',
          readCount,
        };
      }),
    );

    return { data };
  }

  // Chapters - Create
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
      status: body.status ?? 'pending',
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
  async myComments(@Request() req, @Query('sort') sort = 'createdAt', @Query('order') order = 'desc') {
    const sortOrder = order === 'asc' ? 1 : -1;
    const sortField = sort || 'createdAt';

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
      { $sort: { [sortField]: sortOrder } },
      {
        $project: {
          _id: 1,
          content: 1,
          storyId: 1,
          chapterId: 1,
          createdAt: 1,
          isHidden: 1,
          replies: 1,
          storyTitle: '$story.title',
          chapterNumber: '$chapter.number',
          chapterTitle: '$chapter.title',
          readerName: '$user.name',
          userId: 1,
        },
      },
    ]).exec();

    return { data: comments };
  }

  // Author: reply to a comment
  @Post('comments/:id/reply')
  async replyComment(@Request() req, @Param('id') id: string, @Body() body: { content: string }) {
    if (!body.content || !body.content.trim()) {
      throw new BadRequestException('Reply content cannot be empty');
    }

    const comment = await this.commentModel.findById(id).populate('storyId');
    if (!comment) throw new BadRequestException('Comment not found');

    // Verify the comment is on the author's story
    const story = await this.storyModel.findById(comment.storyId);
    if (!story || String(story.authorId) !== req.user.userId) {
      throw new BadRequestException('Not your story');
    }

    // Get author info for the reply
    const authorInfo = req.user; // User object from JWT

    // Initialize replies array if it doesn't exist
    if (!comment.replies) {
      comment.replies = [];
    }

    // Add the reply
    comment.replies.push({
      content: body.content.trim(),
      authorId: req.user.userId,
      authorName: authorInfo.name || 'Tác giả',
      createdAt: new Date(),
    });

    await comment.save();
    return { success: true, message: 'Reply added successfully', comment };
  }
}


