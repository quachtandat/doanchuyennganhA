// views/view.controller.ts

import {
  Controller,
  Get,
  Render,
  Param,
  NotFoundException,
  Query,
  Req,
  Redirect,
  Post,
  Body,
  Res,
} from '@nestjs/common';
import type { Request } from 'express';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, Document } from 'mongoose';
import { ViewService } from './view.service';

// Import schemas
import { Story, StoryDocument } from '../src/stories/schemas/stories.schema';
import {
  Chapter,
  ChapterDocument,
} from '../src/chapters/schemas/chapters.schema';
import { User, UserDocument } from '../src/users/schemas/user.schema';
import { ReadingHistory } from '../src/reading_histories/schemas/reading_histories.schema';
import { Purchase } from '../src/purchases/schemas/purchases.schema';

// Khắc phục lỗi TS2305 (Nếu ReadingHistoryDocument không được export)
type ReadingHistoryDocument = ReadingHistory & Document;
type PurchaseDocument = Purchase & Document;

// ====================================================================
// 2. INTERFACES (ĐÃ HỢP NHẤT VÀ KHẮC PHỤC LỖI TRÙNG LẶP TS2717)
// ====================================================================

// --- Interfaces cho Mongoose .lean() ---

// Định nghĩa Interface cho Story sau khi dùng .lean() (dùng cho home page)
interface LeanStory extends Story {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Dùng cho populate và .lean() (dùng cho story detail)
export interface PopulatedStoryLean
  extends Omit<StoryDocument, 'authorId' | '_id'> {
  _id: Types.ObjectId;
  authorId: UserDocument | null;
}

export interface ChapterLean {
  _id: Types.ObjectId;
  title: string;
  number: number;
}

// --- Interfaces cho Aggregation (Dữ liệu thô) ---

interface LatestChapterAggregation {
  _id: Types.ObjectId; // storyId
  latestChapterNumber: number;
}

interface ChapterCountAggregation {
  _id: Types.ObjectId; // storyId
  totalChapters: number;
}

export interface TopStoryAggregated {
  _id: Types.ObjectId; // storyId
  title: string;
  slug: string;
  coverUrl: string;
  totalReads: number; // Tổng số lượt đọc
  category: string[];
}

// --- Interfaces cho View Model (Dữ liệu hiển thị) ---

// Dùng cho danh sách truyện trên Trang chủ
interface StoryViewModel {
  id: string; // _id đã chuyển thành string
  title: string;
  slug: string;
  image: string; // Tương ứng với coverUrl
  isFull: boolean;
  isHot?: boolean;
  isNew?: boolean;
  categories: string[];
  latestChapter?: number;
  totalChapters?: number;
}

// Dùng cho Sidebar Top Stories
export interface StorySummaryViewModel {
  id: string;
  title: string;
  slug: string;
  image: string;
  categories: string[];
}

/** Cấu trúc một chương cho danh sách chương */
export interface ChapterViewModel {
  id: string; // _id dạng string để dùng trong URL
  title: string; // Vd: "Chương 1: Sự khởi đầu"
}

/** Cấu trúc chi tiết truyện (Khối thông tin chính) */
export interface StoryDetailViewModel {
  id: string;
  title: string;
  slug: string;
  author: string;
  image: string;
  description: string;
  categories: string[];
  status: string;
  rating?: number;
  ratingCount?: number;
  chapters: ChapterViewModel[];
}

/** Cấu trúc tổng thể của dữ liệu Story Page */
export interface StoryPageViewModel {
  story: StoryDetailViewModel;

  // Dữ liệu Sidebar (Đã chuẩn hóa kiểu dữ liệu)
  topStoriesDay: StorySummaryViewModel[];
  topStoriesMonth: StorySummaryViewModel[];
  topStoriesAllTime: StorySummaryViewModel[];
  allCategories: string[];
}

// --- Interfaces cho Chapter Read Page ---

export interface ChapterReadStoryViewModel {
  id: string; // story.id dùng cho URL (chapter.hbs dùng {{story.id}})
  title: string;
}

export interface ChapterReadDetailViewModel {
  id: string; // chapter.id dùng cho URL
  title: string;
  content: string;

  // Thêm các trường này
  isVip: boolean;
  priceCoins: number;
  isPurchased: boolean; // Trạng thái đã mua/mở khóa

  // Dùng cho điều hướng trong chapter.hbs
  prevChapter: string | null; // ID chương trước
  nextChapter: string | null; // ID chương sau
}

export interface ChapterReadPageViewModel {
  story: ChapterReadStoryViewModel;
  chapter: ChapterReadDetailViewModel;
}

// Dùng cho chapter sau khi .lean() (có đủ field)
export interface ChapterFullLean extends Omit<ChapterDocument, '_id'> {
  _id: Types.ObjectId;
  storyId: Types.ObjectId; // Đảm bảo storyId là ObjectId
}

// Dùng cho story sau khi .lean() (chỉ cần title và status)
export interface StoryIdAndStatusLean
  extends Omit<StoryDocument, '_id' | 'authorId'> {
  _id: Types.ObjectId;
  title: string;
  status: string;
}

// Dùng cho prev/next chapter (chỉ cần _id)
export interface IdOnlyLean {
  _id: Types.ObjectId;
}

// ====================================================================
// 3. CONTROLLER VÀ LOGIC LẤY DỮ LIỆU TỪ MONGODB
// ====================================================================

@Controller()
export class ViewController {
  constructor(
    @InjectModel(Story.name) private readonly storyModel: Model<StoryDocument>,
    @InjectModel(Chapter.name)
    private readonly chapterModel: Model<ChapterDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(ReadingHistory.name)
    private readonly readingHistoryModel: Model<ReadingHistoryDocument>,
    @InjectModel(Purchase.name)
    private readonly purchaseModel: Model<PurchaseDocument>,
    private readonly viewService: ViewService,
  ) {}

  /**
   * 🛠️ HÀM TRUY VẤN TOP STORIES SỬ DỤNG AGGREGATION
   */
  private async getTopStories(days: number): Promise<StorySummaryViewModel[]> {
    // Sử dụng kiểu rõ ràng cho điều kiện match (Khắc phục lỗi ESLint/TS về 'any')
    const matchCondition: { [key: string]: any } = {
      'story.status': 'published',
    };

    if (days > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      matchCondition['lastReadAt'] = { $gte: cutoffDate };
    }

    const results = await this.readingHistoryModel
      .aggregate<TopStoryAggregated>([
        { $match: matchCondition },
        // JOIN với bảng Stories
        {
          $lookup: {
            from: 'stories', // Tên collection Story trong MongoDB
            localField: 'storyId',
            foreignField: '_id',
            as: 'story',
          },
        },
        { $unwind: '$story' },
        { $match: { 'story.status': 'published' } },

        // Grouping: Nhóm theo storyId và đếm số lần đọc
        {
          $group: {
            _id: '$storyId',
            title: { $first: '$story.title' },
            slug: { $first: '$story.slug' },
            coverUrl: { $first: '$story.coverUrl' },
            category: { $first: '$story.category' },
            totalReads: { $sum: 1 },
          },
        },
        // Sắp xếp và Giới hạn
        { $sort: { totalReads: -1, title: 1 } },
        { $limit: 5 },
      ])
      .exec();

    // Ánh xạ sang View Model
    return results.map((res) => ({
      id: res._id.toString(),
      title: res.title,
      slug: res.slug,
      image: res.coverUrl,
      categories: res.category,
    }));
  }

  /**
   * 🛠️ HÀM TRUY VẤN TẤT CẢ CÁC DANH MỤC ĐỘC NHẤT
   */
  private async getAllUniqueCategories(): Promise<string[]> {
    const results = await this.storyModel
      .aggregate<{ _id: string }>([
        {
          $match: { status: 'published' },
        },
        { $unwind: '$category' },
        { $group: { _id: '$category' } },
        { $sort: { _id: 1 } },
      ])
      .exec();

    return results.map((res) => res._id);
  }

  /**
   * 🛠️ HÀM HỖ TRỢ EXTRACT USER ID
   */
  private extractUserId(req: Request, token?: string): string | null {
    let userId = (req as any).user?.id;

    // Nếu không có user từ session, thử lấy từ token
    if (!userId && token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.decode(token);
        userId = decoded?.id || decoded?.userId || decoded?.sub;
      } catch (error) {
        // Silent fail
      }
    }

    return userId || null;
  }

  // 🏠 Trang chủ - hiển thị danh sách truyện mới nhất & đã xuất bản
  @Get('/')
  @Render('index')
  async getHome(@Query('key_word') keyWord?: string) {
    if (keyWord && keyWord.trim()) {
      // This should be handled by search route
    }

    const [allCategories, hotStories, newStories, completedStories] =
      await Promise.all([
        this.viewService.getAllCategories(),
        this.viewService.getHotStories(),
        this.viewService.getNewStories(),
        this.viewService.getCompletedStories(),
      ]);

    return {
      categories: allCategories.slice(0, 5),
      allCategories: allCategories,
      hotStories: hotStories,
      newStories: newStories,
      completedStories: completedStories,
      // Hide the global "Explore" link on the index page
      hideExplore: true,
    };
  }

  // ------------------------------------------------
  // AUTH PAGES - Trang đăng nhập và đăng ký
  // ------------------------------------------------

  @Get('auth/login')
  @Render('login')
  async getLogin() {
    const allCategories = await this.viewService.getAllCategories();
    return { allCategories };
  }

  @Get('auth/register')
  @Render('register')
  async getRegister() {
    const allCategories = await this.viewService.getAllCategories();
    return { allCategories };
  }

  // ===================================================================
  // 👤 ACCOUNT PAGE - Trang tài khoản
  // ===================================================================

  @Get('account')
  @Render('account')
  async getAccount(@Req() req: Request, @Query('token') token?: string) {
    const userId = this.extractUserId(req, token);

    let readingHistory: any[] = [];
    if (userId) {
      readingHistory = await this.viewService.getUserReadingHistory(userId);
    }

    const allCategories = await this.viewService.getAllCategories();

    return {
      readingHistory,
      userId,
      allCategories,
    };
  }

  // ===================================================================
  // ⚙️ ADMIN PAGE
  // ===================================================================
  @Get('admin')
  @Render('admin')
  async getAdmin() {
    const allCategories = await this.viewService.getAllCategories();
    return { allCategories };
  }

  // ===================================================================
  // ✍️ AUTHOR PAGE
  // ===================================================================
  @Get('author')
  async getAuthor(@Req() req: Request, @Query('token') token?: string, @Res() res?: any) {
    // Try to extract role from session user first
    const sessionUser: any = (req as any).user;
    if (sessionUser && sessionUser.role === 'author') {
      const allCategories = await this.viewService.getAllCategories();
      return res.render('author', { allCategories });
    }

    // If token provided (we will pass it from client when navigating), decode and check role
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded: any = jwt.decode(token);
        if (decoded && decoded.role === 'author') {
          const allCategories = await this.viewService.getAllCategories();
          return res.render('author', { allCategories });
        }
      } catch (e) {
        // ignore decode errors
      }
    }

    // Not authorized to view author page
    return res.redirect('/');
  }

  // ===================================================================
  // 🔍 SEARCH - Tìm kiếm truyện
  // ===================================================================

  @Get('search')
  @Render('search')
  async searchStories(
    @Query('q') query?: string,
    @Query('key_word') keyWord?: string,
  ) {
    // Handle both parameter names for backward compatibility
    const searchQuery = query || keyWord;

    if (!searchQuery) {
      return {
        stories: [],
        query: '',
        allCategories: await this.viewService.getAllCategories(),
      };
    }

    const [stories, allCategories] = await Promise.all([
      this.viewService.searchStories(searchQuery),
      this.viewService.getAllCategories(),
    ]);

    return {
      stories,
      query: searchQuery,
      allCategories,
    };
  }

  // ===================================================================
  // 📂 CATEGORY - Trang thể loại
  // ===================================================================

  @Get('category/:categoryName')
  @Render('category')
  async getCategoryStories(@Param('categoryName') categoryName: string) {
    const [stories, allCategories] = await Promise.all([
      this.viewService.getStoriesByCategory(categoryName),
      this.viewService.getAllCategories(),
    ]);

    return {
      categoryName,
      stories,
      allCategories,
    };
  }

  // ------------------------------------------------
  // Trang chi tiết truyện: /story/:slug
  // ------------------------------------------------
  @Get('story/:slug')
  @Render('story')
  async getStoryDetail(@Param('slug') slug: string) {
    const result = await this.viewService.getStoryDetail(slug);
    if (!result) {
      throw new NotFoundException(`Không tìm thấy truyện với slug: ${slug}`);
    }

    return result;
  }

  // ------------------------------------------------
  // Trang đọc chương: /story/:storyId/chapter/:chapterId
  // ------------------------------------------------
  @Get('story/:storyId/chapter/:chapterId')
  @Render('chapter')
  async getChapterDetail(
    @Param('storyId') storyId: string,
    @Param('chapterId') chapterId: string,
    @Req() req: Request,
    @Query('token') token?: string,
  ) {
    const userId = this.extractUserId(req, token);

    const result = await this.viewService.getChapterDetail(
      storyId,
      chapterId,
      userId || undefined,
    );

    if (!result) {
      throw new NotFoundException('Không tìm thấy chương hoặc truyện.');
    }

    // Ensure header/category partial has categories available
    const allCategories = await this.viewService.getAllCategories();

    return {
      ...result,
      allCategories,
    };
  }

  // ===================================================================
  // 📄 API: Lấy danh sách chương JSON theo truyện
  // ===================================================================
  @Get('api/story/:storyId/chapters')
  async apiGetStoryChapters(@Param('storyId') storyId: string) {
    return await this.viewService.getStoryChapters(storyId);
  }

  // ------------------------------------------------
  // Explore API + page
  // ------------------------------------------------
  @Get('explore')
  @Render('explore')
  async getExplorePage() {
    const allCategories = await this.viewService.getAllCategories();
    return { allCategories };
  }

  @Get('api/explore')
  async apiExplore(@Query('category') category?: string, @Query('status') status?: string, @Query('sort') sort?: string) {
    // delegate to viewService with filters
    const stories = await this.viewService.getExploreStories({ category, status, sort });
    return { stories };
  }

  // ===================================================================
  // 🐛 DEBUG: Hot Stories
  // ===================================================================
  @Get('debug/hot-stories')
  async debugHotStories() {
    return await this.viewService.debugHotStories();
  }

  // ===================================================================
  // 📖 API: Lấy reading history
  // ===================================================================
  @Get('api/reading-history')
  async getReadingHistory(@Req() req: Request, @Query('token') token?: string) {
    const userId = this.extractUserId(req, token);

    if (!userId) {
      return { error: 'User not authenticated', readingHistory: [] };
    }

    const readingHistory = await this.viewService.getUserReadingHistory(userId);
    return { readingHistory };
  }
}
