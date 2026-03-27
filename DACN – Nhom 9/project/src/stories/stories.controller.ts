import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Query,
  UseGuards,
  Request,
  UnauthorizedException,
  Headers,
} from '@nestjs/common';
import { StoriesService } from './stories.service';
import { CreateStoryDto } from './dto/create-story.dto';
import { UpdateStoryDto } from './dto/update-story.dto';
import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Story, StoryDocument } from './schemas/stories.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/stories')
export class StoriesController {
  constructor(
    private readonly storiesService: StoriesService,
    @InjectModel(Story.name) private readonly storyModel: Model<StoryDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() dto: CreateStoryDto, @Request() req) {
    // Force authorId to currently authenticated user
    const userId = req.user.userId;
    dto.authorId = userId;
    return this.storiesService.create(dto);
  }

  // DEBUG: check how stories are stored for a given authorId (ObjectId vs string)
  @Get('debug/author/:authorId')
  async debugAuthor(@Param('authorId') authorId: string) {
    const results: any = {};
    try {
      // Query 1: authorId as ObjectId
      let oidMatch: any[] = [];
      try {
        oidMatch = await this.storyModel.find({ authorId: new Types.ObjectId(authorId) }).limit(20).lean();
      } catch (e) {
        oidMatch = [];
      }

      // Query 2: authorId as string
      const strMatch: any[] = await this.storyModel.find({ authorId: authorId }).limit(20).lean();

      // Sample some stories to inspect stored authorId values and types
      const sample = await this.storyModel.find().limit(50).select('title authorId').lean();

      results.queriedAuthorId = authorId;
      results.oidMatchCount = oidMatch.length;
      results.strMatchCount = strMatch.length;
      results.oidMatch = oidMatch.slice(0, 10);
      results.strMatch = strMatch.slice(0, 10);
      results.sample = sample.map(s => ({ title: s.title, authorId: s.authorId, authorIdType: typeof s.authorId }));
    } catch (err) {
      results.error = String(err);
    }
    return results;
  }

  @Get('filter')
  async filterStories(
    @Query('sortBy') sortBy = 'lastUpdated',
    @Query('order') order = 'desc',
    @Query('status') status = 'all',
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Headers('accept') accept?: string, // ✅ THÊM để debug
  ) {
    console.log('📨 Filter request:', { sortBy, order, status, page, limit });
    console.log('📨 Accept header:', accept);

    const result = await this.storiesService.filterStories({
      sortBy,
      order,
      status,
      page: Number(page),
      limit: Number(limit),
    });

    console.log('📤 Returning:', result);
    return result; // ✅ NestJS tự động parse thành JSON
  }

  @Get()
  findAll(
    @Query('skip') skip = 0,
    @Query('limit') limit = 20,
    @Query('authorId') authorId?: string,
    @Query('q') q?: string,
    @Query('populateAuthor') populateAuthor?: string,
    @Query('authorName') authorName?: string,
  ) {
    // Debug: log incoming authorId
    if (authorId) {
      console.log('[StoriesController] findAll called with authorId:', authorId);
    }

    let filter: any = {};
    if (authorId) {
      try {
        // Match both ObjectId and string storage formats
        filter = {
          $or: [
            { authorId: new Types.ObjectId(authorId) },
            { authorId: authorId },
          ],
        };
      } catch (e) {
        // if invalid ObjectId, fallback to string match only
        filter = { authorId: authorId };
      }
    }

    // allow title search via q param
    if (q && q.trim()) {
      filter = { ...filter, title: { $regex: q.trim(), $options: 'i' } };
    }
    const populate = populateAuthor === '1' || populateAuthor === 'true';
    return this.storiesService.findAll(Number(skip), Number(limit), filter as any, populate, authorName);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.storiesService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateStoryDto, @Request() req) {
    const story = await this.storyModel.findById(id);
    if (!story) throw new UnauthorizedException('Story not found');

    // get current user and check ownership or admin
    const currentUser = await this.userModel.findById(req.user.userId);
    if (!currentUser) throw new UnauthorizedException('User not found');

    const isOwner = story.authorId && story.authorId.toString() === req.user.userId;
    const isAdmin = currentUser.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new UnauthorizedException('Không có quyền chỉnh sửa truyện này');
    }

    return this.storiesService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req) {
    const story = await this.storyModel.findById(id);
    if (!story) throw new UnauthorizedException('Story not found');

    const currentUser = await this.userModel.findById(req.user.userId);
    if (!currentUser) throw new UnauthorizedException('User not found');

    const isOwner = story.authorId && story.authorId.toString() === req.user.userId;
    const isAdmin = currentUser.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new UnauthorizedException('Không có quyền xóa truyện này');
    }

    return this.storiesService.remove(id);
  }

  // Admin: duyệt (published) hoặc từ chối (rejected)
  @Put(':id/approve')
  async approve(@Param('id') id: string) {
    return this.storyModel.findByIdAndUpdate(
      id,
      { status: 'published' },
      { new: true },
    );
  }

  @Put(':id/reject')
  async reject(@Param('id') id: string) {
    return this.storyModel.findByIdAndUpdate(
      id,
      { status: 'rejected' },
      { new: true },
    );
  }

  // Admin: ẩn/bỏ ẩn
  @Put(':id/hide')
  async hide(@Param('id') id: string) {
    return this.storyModel.findByIdAndUpdate(
      id,
      { isHidden: true },
      { new: true },
    );
  }

  @Put(':id/unhide')
  async unhide(@Param('id') id: string) {
    return this.storyModel.findByIdAndUpdate(
      id,
      { isHidden: false },
      { new: true },
    );
  }
}
