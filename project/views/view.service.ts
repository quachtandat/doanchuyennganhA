import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, Document } from 'mongoose';
import { Story, StoryDocument } from '../src/stories/schemas/stories.schema';
import { Chapter, ChapterDocument } from '../src/chapters/schemas/chapters.schema';
import { User, UserDocument } from '../src/users/schemas/user.schema';
import { ReadingHistory } from '../src/reading_histories/schemas/reading_histories.schema';
import { Purchase } from '../src/purchases/schemas/purchases.schema';
import { Payment } from '../src/payments/schemas/payment.schema';
import { Report } from '../src/reports/schemas/reports.schema';
import { AuthorRequest, AuthorRequestDocument } from '../src/author_requests/schemas/author_request.schema';
import { Comment, CommentDocument } from '../src/comments/schemas/comment.schema';

type ReadingHistoryDocument = ReadingHistory & Document;
type PurchaseDocument = Purchase & Document;
type PaymentDocument = Payment & Document;

@Injectable()
export class ViewService {
  constructor(
    @InjectModel(Story.name) private readonly storyModel: Model<StoryDocument>,
    @InjectModel(Chapter.name) private readonly chapterModel: Model<ChapterDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(ReadingHistory.name) private readonly readingHistoryModel: Model<ReadingHistoryDocument>,
    @InjectModel(Purchase.name) private readonly purchaseModel: Model<PurchaseDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Report.name) private readonly reportModel: Model<Report & Document>,
    @InjectModel(AuthorRequest.name) private readonly authorRequestModel: Model<AuthorRequestDocument>,
    @InjectModel(Comment.name) private readonly commentModel: Model<CommentDocument>,
  ) { }

  /**
   * Lấy tất cả thể loại duy nhất
   */
  async getAllCategories(): Promise<string[]> {
    return await this.storyModel.distinct('category', {
      status: 'published',
    });
  }

  /**
   * Lấy truyện hot dựa trên HotScore
   * HotScore = (ViewToday - ViewYesterday)*0.6 
   *          + (ViewToday / (ViewLast7Days / 7))*0.3
   *          + (CommentToday * 0.1)
   */
  async getHotStories(): Promise<any[]> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    console.log(`[HOT STORIES] Today: ${today.toISOString()}, Yesterday: ${yesterday.toISOString()}, 7DaysAgo: ${sevenDaysAgo.toISOString()}`);

    // Lấy tất cả truyện published
    const allStories = await this.storyModel.find({ status: 'published' }).lean();
    
    if (allStories.length === 0) {
      console.log('[HOT STORIES] No published stories found');
      return [];
    }

    // Tính toán HotScore cho mỗi truyện
    const storiesWithScores = await Promise.all(
      allStories.map(async (story) => {
        const storyId = story._id.toString();
        const storyObjectId = new Types.ObjectId(storyId);

        // Tính views của hôm nay
        const viewToday = await this.readingHistoryModel.countDocuments({
          storyId: { $in: [storyId, storyObjectId] },
          lastReadAt: { $gte: today },
        });

        // Tính views của hôm qua
        const viewYesterday = await this.readingHistoryModel.countDocuments({
          storyId: { $in: [storyId, storyObjectId] },
          lastReadAt: { $gte: yesterday, $lt: today },
        });

        // Tính views trong 7 ngày
        const viewLast7Days = await this.readingHistoryModel.countDocuments({
          storyId: { $in: [storyId, storyObjectId] },
          lastReadAt: { $gte: sevenDaysAgo },
        });

        // Tính comments của hôm nay
        const commentToday = await this.commentModel.countDocuments({
          storyId: { $in: [storyId, storyObjectId] },
          createdAt: { $gte: today },
        });

        // Tính HotScore
        let hotScore = 0;
        
        // Thành phần 1: (ViewToday - ViewYesterday) * 0.6
        hotScore += (viewToday - viewYesterday) * 0.6;
        
        // Thành phần 2: (ViewToday / (ViewLast7Days / 7)) * 0.3
        const avgViewPerDay = viewLast7Days > 0 ? viewLast7Days / 7 : 1;
        hotScore += (viewToday / avgViewPerDay) * 0.3;
        
        // Thành phần 3: CommentToday * 0.1
        hotScore += commentToday * 0.1;

        console.log(`[HOT STORIES] ${story.title}: viewToday=${viewToday}, viewYesterday=${viewYesterday}, viewLast7Days=${viewLast7Days}, commentToday=${commentToday}, hotScore=${hotScore.toFixed(2)}`);

        return {
          ...story,
          hotScore,
          viewToday,
          viewYesterday,
          viewLast7Days,
          commentToday,
        };
      }),
    );

    // Sắp xếp theo HotScore giảm dần và lấy top 8
    const topHotStories = storiesWithScores
      .sort((a, b) => b.hotScore - a.hotScore)
      .slice(0, 8);

    console.log(`[HOT STORIES] Top 8 stories:`, topHotStories.map(s => ({ title: s.title, hotScore: s.hotScore })));

    return topHotStories.map((story) => ({
      id: story._id.toString(),
      title: story.title,
      slug: story.slug,
      image: story.coverUrl || '',
      categories: story.category,
      isHot: true,
      isNew: false,
      isFull: false,
    }));
  }

  /**
   * Debug method để kiểm tra hot stories
   */
  async debugHotStories(): Promise<any> {
    console.log('=== DEBUG HOT STORIES ===');
    
    // 1. Kiểm tra reading history count
    const readingHistoryCount = await this.readingHistoryModel.countDocuments();
    console.log(`Total reading history records: ${readingHistoryCount}`);
    
    // 2. Kiểm tra reading history trong 30 ngày qua (thay vì 7 ngày)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentHistoryCount = await this.readingHistoryModel.countDocuments({
      lastReadAt: { $gte: thirtyDaysAgo }
    });
    console.log(`Reading history in last 30 days: ${recentHistoryCount}`);
    
    // 3. Lấy sample reading history
    const sampleHistory = await this.readingHistoryModel.find({}).limit(3).lean();
    console.log('Sample reading history:', sampleHistory.map(h => ({
      storyId: h.storyId,
      storyIdType: typeof h.storyId,
      lastReadAt: h.lastReadAt
    })));
    
    // 4. Test aggregation pipeline với 30 ngày
    const aggregationResult = await this.readingHistoryModel
      .aggregate([
        { $match: { lastReadAt: { $gte: thirtyDaysAgo } } },
        {
          $addFields: {
            storyObjectId: {
              $cond: {
                if: { $type: "$storyId" },
                then: { $toObjectId: "$storyId" },
                else: "$storyId"
              }
            }
          }
        },
        {
          $lookup: {
            from: 'stories',
            localField: 'storyObjectId',
            foreignField: '_id',
            as: 'story',
          },
        },
        { $unwind: '$story' },
        { $match: { 'story.status': 'published' } },
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
        { $sort: { totalReads: -1 } },
        { $limit: 5 },
      ])
      .exec();
    
    console.log(`Aggregation result count: ${aggregationResult.length}`);
    console.log('Aggregation results:', aggregationResult);
    
    // 5. Kiểm tra stories collection
    const storiesCount = await this.storyModel.countDocuments({ status: 'published' });
    console.log(`Published stories count: ${storiesCount}`);
    
    return {
      readingHistoryCount,
      recentHistoryCount,
      sampleHistory: sampleHistory.map(h => ({
        storyId: h.storyId,
        storyIdType: typeof h.storyId,
        lastReadAt: h.lastReadAt
      })),
      aggregationResult,
      storiesCount
    };
  }

  /**
   * Lấy truyện mới (đăng trong 7 ngày)
   */
  async getNewStories(): Promise<any[]> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    let stories = await this.storyModel
      .find({
        status: 'published',
        createdAt: { $gte: sevenDaysAgo },
      })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Fallback: nếu 7 ngày qua không có truyện mới, lấy 10 truyện xuất bản gần nhất
    if (!stories || stories.length === 0) {
      stories = await this.storyModel
        .find({ status: 'published' })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();
    }

    // Lấy chương mới nhất cho mỗi truyện
    const storyIds = stories.map(story => story._id.toString());
    const latestChapters = await this.chapterModel.aggregate([
      {
        $match: {
          storyId: { $in: storyIds },
          status: 'published',
        },
      },
      {
        $sort: { storyId: 1, number: -1 },
      },
      {
        $group: {
          _id: '$storyId',
          latestChapterId: { $first: '$_id' },
          latestChapterNumber: { $first: '$number' },
        },
      },
    ]);

    const chapterMap = latestChapters.reduce((map, chapter) => {
      map.set(chapter._id.toString(), {
        id: chapter.latestChapterId.toString(),
        number: chapter.latestChapterNumber,
      });
      return map;
    }, new Map<string, { id: string; number: number }>());

    return stories.map((story, index) => ({
      id: story._id.toString(),
      title: story.title,
      slug: story.slug,
      image: story.coverUrl || '',
      categories: story.category,
      isHot: false,
      // Consider a story "new" if it's within the last 14 days
      isNew: (story as any).createdAt
        ? (new Date((story as any).createdAt).getTime() >= Date.now() - 14 * 24 * 60 * 60 * 1000)
        : false,
      isFull: false,
      latestChapterId: chapterMap.get(story._id.toString())?.id || null,
      latestChapterNumber: chapterMap.get(story._id.toString())?.number || 0,
    }));
  }

  /**
   * Lấy truyện đã hoàn thành (dựa trên số chương)
   */
  async getCompletedStories(): Promise<any[]> {
    // Lấy tất cả truyện đã published
    const stories = await this.storyModel
      .find({ status: 'published' })
      .select('_id title slug coverUrl category expectedTotalChapters')
      .lean();

    const storyIds = stories.map(story => story._id.toString());
    
    // Đếm số chương cho mỗi truyện
    const chapterCounts = await this.chapterModel.aggregate([
      {
        $match: {
          storyId: { $in: storyIds },
          status: 'published',
        },
      },
      {
        $group: {
          _id: '$storyId',
          totalChapters: { $sum: 1 },
        },
      },
    ]);

    const countMap = chapterCounts.reduce((map, count) => {
      map.set(count._id.toString(), count.totalChapters);
      return map;
    }, new Map<string, number>());

    // Xác định hoàn thành: nếu expectedTotalChapters có giá trị và tổng chương >= expectedTotalChapters
    const completedStories = stories
      .filter(story => {
        const totalChapters = countMap.get(story._id.toString()) || 0;
        const expected = (story as any).expectedTotalChapters as number | null;
        if (typeof expected === 'number' && expected > 0) {
          return totalChapters >= expected;
        }
        // Nếu không có expectedTotalChapters, coi như chưa xác định -> không tính completed
        return false;
      })
      .sort((a, b) => {
        const ta = countMap.get(a._id.toString()) || 0;
        const tb = countMap.get(b._id.toString()) || 0;
        return tb - ta;
      })
      .slice(0, 8)
      .map(story => ({
        id: story._id.toString(),
        title: story.title,
        slug: story.slug,
        image: story.coverUrl || '',
        categories: story.category,
        isHot: false,
        isNew: false,
        isFull: true,
        totalChapters: countMap.get(story._id.toString()) || 0,
      }));

    return completedStories;
  }

  /**
   * Tìm kiếm truyện theo tên hoặc tác giả
   */
  async searchStories(query: string): Promise<any[]> {
    if (!query || query.trim() === '') {
      return [];
    }
    
    const searchRegex = new RegExp(query.trim(), 'i');
    
    // Get author IDs that match the search query - search both name and display_name
    const authorIds = await this.userModel
      .find({
        $or: [
          { name: searchRegex },
          { 'author_info.display_name': searchRegex },
        ],
      })
      .distinct('_id');

    // Normalize author id formats to handle mixed storage (string or ObjectId)
    const authorIdStrings = authorIds.map((id: any) => id.toString());
    const authorIdObjectIds = authorIds
      .filter((id: any) => Types.ObjectId.isValid(id))
      .map((id: any) => new Types.ObjectId(id));

    const authorIdMixed = Array.from(
      new Set<string | Types.ObjectId>([...authorIdStrings, ...authorIdObjectIds]),
    );

    const stories = await this.storyModel
      .find({
        status: 'published',
        $or: [
          { title: searchRegex },
          { authorId: { $in: authorIdMixed } },
        ],
      })
      .populate('authorId', 'name author_info.display_name')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return stories.map(story => ({
      id: story._id.toString(),
      title: story.title,
      slug: story.slug,
      image: story.coverUrl || '',
      categories: story.category,
      author: (story.authorId as any)?.author_info?.display_name || (story.authorId as any)?.name || 'Ẩn danh',
      isHot: false,
      isNew: false,
      isFull: false,
    }));
  }

  /**
   * Explore stories with filters used by the Explore page
   */
  async getExploreStories(filters: { category?: string; status?: string; sort?: string }): Promise<any[]> {
    const { category, status, sort } = filters || {};
    const q: any = { status: 'published' };
    if (status === 'published' || status === 'Đang ra') q.status = 'published';
    if (status === 'completed' || status === 'Đã hoàn thành') q.status = 'completed';
    if (category) q.category = { $in: [new RegExp(category, 'i')] };

    let cursor = this.storyModel.find(q).lean();

    // Sorting
    if (sort === 'most_viewed') {
      // sort by reading history count (best effort via lookup/aggregation is heavier); fallback to createdAt
      cursor = this.storyModel.find(q).sort({ createdAt: -1 }).lean();
    } else if (sort === 'top_rated') {
      cursor = this.storyModel.find(q).sort({ ratingAverage: -1 }).lean();
    } else if (sort === 'updated') {
      cursor = this.storyModel.find(q).sort({ updatedAt: -1 }).lean();
    } else {
      cursor = this.storyModel.find(q).sort({ createdAt: -1 }).lean();
    }

    const docs = await cursor.limit(100).exec();
    return docs.map(story => ({
      id: (story as any)._id.toString(),
      title: (story as any).title,
      slug: (story as any).slug,
      image: (story as any).coverUrl || '',
      categories: (story as any).category || [],
      author: (story as any).author || '',
      description: (story as any).description || '',
    }));
  }

  /**
   * Lấy truyện theo thể loại
   */
  async getStoriesByCategory(categoryName: string): Promise<any[]> {
    const stories = await this.storyModel
      .find({
        status: 'published',
        category: { $in: [new RegExp(categoryName, 'i')] }
      })
      .populate('authorId', 'name author_info.display_name')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return stories.map(story => ({
      id: story._id.toString(),
      title: story.title,
      slug: story.slug,
      image: story.coverUrl || '',
      categories: story.category,
      author: (story.authorId as any)?.author_info?.display_name || (story.authorId as any)?.name || 'Ẩn danh',
      isHot: false,
      isNew: false,
      isFull: false,
    }));
  }

  /**
   * Lấy lịch sử đọc của user
   */
  async getUserReadingHistory(userId: string): Promise<any[]> {
    const histories = await this.readingHistoryModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('storyId', 'title slug coverUrl category')
      .populate('lastChapterId', 'title number')
      .sort({ lastReadAt: -1 })
      .limit(20)
      .lean();

    // Tính tiến độ dựa trên số chương đã đọc
    const historiesWithProgress = await Promise.all(
      histories
        .filter(history => history.storyId !== null) // Lọc bỏ stories bị xóa
        .map(async (history) => {
          const storyId = (history.storyId as any)._id.toString();
          
          // Đếm tổng số chương của truyện
          const totalChapters = await this.chapterModel.countDocuments({
            storyId: { $in: [storyId, new Types.ObjectId(storyId)] },
            status: 'published'
          });
          
          // Đếm số chương đã đọc (dựa trên chương cuối đã đọc)
          const lastChapterNumber = history.lastChapterId ? (history.lastChapterId as any).number : 0;
          const readChapters = Math.max(0, lastChapterNumber);
          
          // Tính tiến độ phần trăm
          const progress = totalChapters > 0 ? Math.min(100, Math.round((readChapters / totalChapters) * 100)) : 0;
          const isFinished = progress >= 100;

          return {
            id: storyId,
            title: (history.storyId as any).title,
            slug: (history.storyId as any).slug,
            image: (history.storyId as any).coverUrl || '',
            categories: (history.storyId as any).category,
            lastChapter: history.lastChapterId ? {
              id: (history.lastChapterId as any)._id.toString(),
              title: (history.lastChapterId as any).title,
              number: (history.lastChapterId as any).number,
            } : null,
            lastReadAt: history.lastReadAt,
            progressText: `${readChapters}/${totalChapters}`,
            isFinished,
            totalChapters,
            readChapters,
          };
      })
    );

    return historiesWithProgress;
  }

  /**
   * Lưu lịch sử đọc
   */
  async saveReadingHistory(userId: string, storyId: string, chapterId: string, progress: number = 0): Promise<void> {
    try {
      await this.readingHistoryModel.findOneAndUpdate(
        { userId: new Types.ObjectId(userId), storyId: new Types.ObjectId(storyId) },
        {
          userId: new Types.ObjectId(userId),
          storyId: new Types.ObjectId(storyId),
          lastChapterId: new Types.ObjectId(chapterId),
          lastReadAt: new Date(),
          progress,
          isFinished: progress >= 100,
        },
        { upsert: true, new: true }
      );
    } catch (error) {
      console.error(`[SAVE HISTORY] Error saving reading history:`, error);
      throw error;
    }
  }

  /**
   * Lấy danh sách chương của truyện
   */
  async getStoryChapters(storyId: string): Promise<any[]> {
    // Try multiple query formats since database might have mixed data types
    const queries = [
      // Query 1: String format (as stored in your database)
      { storyId: storyId, status: 'published' },
      // Query 2: ObjectId format (as per schema)
      { storyId: new Types.ObjectId(storyId), status: 'published' },
      // Query 3: String format without status filter
      { storyId: storyId },
      // Query 4: ObjectId format without status filter  
      { storyId: new Types.ObjectId(storyId) }
    ];
    
    let chapters: any[] = [];
    
    // Try each query until we find chapters
    for (let i = 0; i < queries.length; i++) {
      chapters = await this.chapterModel
        .find(queries[i])
        .select('_id title number isVip priceCoins storyId status')
        .sort({ number: 1 })
        .lean();
        
      if (chapters.length > 0) {
        break;
      }
    }

    return chapters.map(chapter => ({
      id: chapter._id.toString(),
      title: `Chương ${chapter.number}: ${chapter.title}`,
      number: chapter.number,
      isVip: chapter.isVip,
      priceCoins: chapter.priceCoins,
    }));
  }

  /**
   * Lấy top truyện theo thời gian
   */
  async getTopStories(days: number): Promise<any[]> {
    console.log(`[TOP STORIES] Getting top stories for ${days} days`);
    
    const matchCondition: any = {}; // Bỏ 'story.status' khỏi match đầu tiên

    if (days > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      matchCondition['lastReadAt'] = { $gte: cutoffDate };
      console.log(`[TOP STORIES] Filtering from: ${cutoffDate}`);
    }

    const results = await this.readingHistoryModel
      .aggregate([
        { $match: matchCondition },
        {
          $addFields: {
            storyObjectId: {
              $cond: {
                if: { $type: "$storyId" },
                then: { $toObjectId: "$storyId" },
                else: "$storyId"
              }
            }
          }
        },
        {
          $lookup: {
            from: 'stories',
            localField: 'storyObjectId',
            foreignField: '_id',
            as: 'story',
          },
        },
        { $unwind: '$story' },
        { $match: { 'story.status': 'published' } },
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
        { $sort: { totalReads: -1, title: 1 } },
        { $limit: 5 },
      ])
      .exec();

    console.log(`[TOP STORIES] Found ${results.length} results for ${days} days`);
    
    // Fallback nếu không có kết quả
    if (results.length === 0) {
      console.log(`[TOP STORIES] No results for ${days} days, using fallback`);
      const stories = await this.storyModel
        .find({ status: 'published' })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

      return stories.map((story) => ({
        id: story._id.toString(),
        title: story.title,
        slug: story.slug,
        image: story.coverUrl,
        categories: story.category,
      }));
    }

    return results.map((story) => ({
      id: story._id.toString(),
      title: story.title,
      slug: story.slug,
      image: story.coverUrl,
      categories: story.category,
    }));
  }

  /**
   * Lấy thống kê tổng quan cho admin dashboard
   */
  async getAdminOverview(): Promise<any> {
    const [usersCount, storiesCount, chaptersCount, readsCount] = await Promise.all([
      this.userModel.countDocuments({}),
      this.storyModel.countDocuments({}),
      this.chapterModel.countDocuments({}),
      this.readingHistoryModel.countDocuments({}),
    ]);
    
    // Tổng doanh thu từ Payment (amount lưu bằng VNĐ)
    const revenueAgg = await this.paymentModel.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$amount', 0] } } } },
    ]).exec();

    const revenue = revenueAgg && revenueAgg.length > 0 ? Math.floor(revenueAgg[0].total) : 0;

    return {
      users: usersCount,
      stories: storiesCount,
      chapters: chaptersCount,
      reads: readsCount,
      revenue,
    };
  }


  /**
   * Lấy chi tiết truyện
   */
  async getStoryDetail(slug: string): Promise<any> {
    let findCondition: any;
    const isObjectId = Types.ObjectId.isValid(slug);

    if (isObjectId) {
      findCondition = {
        _id: new Types.ObjectId(slug),
        status: 'published',
      };
    } else {
      findCondition = {
        slug: slug,
        status: 'published',
      };
    }

    const story = await this.storyModel
      .findOne(findCondition)
      .populate('authorId', 'name author_info.display_name')
      .lean();

    if (!story) {
      return null;
    }

    const chapters = await this.getStoryChapters(story._id.toString());
    
    const [topStoriesDay, topStoriesMonth, topStoriesAllTime, allCategories] = await Promise.all([
      this.getTopStories(1),
      this.getTopStories(30),
      this.getTopStories(0),
      this.getAllCategories(),
    ]);

    return {
      story: {
        id: story._id.toString(),
        title: story.title,
        slug: story.slug,
        author: (story.authorId as any)?.author_info?.display_name || (story.authorId as any)?.name || 'Ẩn danh',
        image: story.coverUrl,
        description: story.description,
        categories: story.category,
        status: story.status === 'completed' ? 'Đã hoàn thành' : 'Đang ra',
        chapters,
      },
      topStoriesDay,
      topStoriesMonth,
      topStoriesAllTime,
      allCategories,
    };
  }

  /**
  * Lấy chi tiết chương
  */
  async getChapterDetail(storyId: string, chapterId: string, userId?: string): Promise<any> {
    const [chapter, story] = await Promise.all([
      this.chapterModel.findById(chapterId).lean(),
      this.storyModel.findById(storyId).select('title status').lean(),
    ]);

    if (!chapter || !story || story.status !== 'published' || chapter.status !== 'published') {
      return null;
    }
  
    // Kiểm tra storyId match với cả string và ObjectId format
    const storyIdMatch = chapter.storyId.toString() === storyId ||
      chapter.storyId.toString() === new Types.ObjectId(storyId).toString();
  
    if (!storyIdMatch) {
      return null;
    }

    // Lấy chương trước và sau - xử lý cả string và ObjectId format
    const storyIdQueries = [
      storyId, // String format
      new Types.ObjectId(storyId) // ObjectId format
    ];
  
    let prevChapter: any = null;
    let nextChapter: any = null;
  
    // Thử tìm với cả hai format
    for (const storyIdQuery of storyIdQueries) {
      const [prev, next] = await Promise.all([
        this.chapterModel
          .findOne({
            storyId: storyIdQuery,
            status: 'published',
            number: { $lt: chapter.number },
          })
          .select('_id')
          .sort({ number: -1 })
          .lean(),
        this.chapterModel
          .findOne({
            storyId: storyIdQuery,
            status: 'published',
            number: { $gt: chapter.number },
          })
          .select('_id')
          .sort({ number: 1 })
          .lean(),
      ]);
    
      if (prev || next) {
        prevChapter = prev;
        nextChapter = next;
        break;
      }
    }

    // ✅ FIX: Kiểm tra mua chương VIP
    let isPurchased = false;

    if (chapter.isVip) {
      if (userId) {
        const purchase = await this.purchaseModel
          .findOne({
            userId: new Types.ObjectId(userId),
            chapterId: new Types.ObjectId(chapterId),
            status: 'completed',
          })
          .exec();

        isPurchased = !!purchase;
      }
    } else {
      // Chương FREE -> luôn được mở
      isPurchased = true;
    }

    // ✅ FIX: LUÔN trả về content thật - Frontend sẽ quyết định hiển thị
    const content = chapter.content || 'Nội dung chương đang được cập nhật.';

    // Lưu lịch sử đọc nếu có user VÀ đã mua (hoặc là free)
    if (userId && isPurchased) {
      await this.saveReadingHistory(userId, storyId, chapterId, 0);
    }

    return {
      story: {
        id: story._id.toString(),
        title: story.title,
      },
      chapter: {
        id: chapter._id.toString(),
        title: `Chương ${chapter.number}: ${chapter.title}`,
        content: content, // ✅ Luôn trả content thật
        isVip: chapter.isVip,
        priceCoins: chapter.priceCoins,
        isPurchased: isPurchased, // ✅ Frontend dùng field này để hiện/ẩn
        prevChapter: prevChapter ? prevChapter._id.toString() : null,
        nextChapter: nextChapter ? nextChapter._id.toString() : null,
      },
    };
  }

  /**
   * Lấy dữ liệu lượt đọc theo ngày (30 ngày gần nhất)
   */
  async getReadingStatsDaily(): Promise<any[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const stats = await this.readingHistoryModel
      .aggregate([
        {
          $match: {
            lastReadAt: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$lastReadAt',
                timezone: 'Asia/Ho_Chi_Minh',
              },
            },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ])
      .exec();

    return stats;
  }

  /**
   * Lấy dữ liệu doanh thu theo tháng (12 tháng gần nhất) từ Purchase - tính bằng COIN
   */
  async getRevenueStatsMonthlyCoins(): Promise<any[]> {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    console.log('[Revenue Coins] Query from:', twelveMonthsAgo);

    // Lấy từ bảng Purchase (doanh thu từ mua chương)
    const stats = await this.purchaseModel
      .aggregate([
        {
          $match: {
            status: 'completed',
            purchaseAt: { $gte: twelveMonthsAgo },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m',
                date: '$purchaseAt',
                timezone: 'Asia/Ho_Chi_Minh',
              },
            },
            total: { $sum: { $ifNull: ['$priceCoins', 0] } },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ])
      .exec();

    console.log('[Revenue Coins] Stats result:', stats);
    return stats || [];
  }
  /**
   * Lấy dữ liệu doanh thu theo tháng (12 tháng gần nhất) từ Payment - tính bằng VNĐ
   */
  async getRevenueStatsMonthlyVnd(): Promise<any[]> {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    console.log('[Revenue VND] Query from (payments):', twelveMonthsAgo);

    // Lấy từ bảng Payment (amount đã là VNĐ)
    const stats = await this.paymentModel
      .aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: twelveMonthsAgo },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m',
                date: '$createdAt',
                timezone: 'Asia/Ho_Chi_Minh',
              },
            },
            total: { $sum: { $ifNull: ['$amount', 0] } },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ])
      .exec();

    console.log('[Revenue VND] Stats result (payments):', stats);
    return stats || [];
  }

  /**
   * Lấy dữ liệu doanh thu theo tháng (deprecated)
   */
  async getRevenueStatsMonthly(): Promise<any[]> {
    return this.getRevenueStatsMonthlyVnd();
  }

  /**
   * Lấy báo cáo gần đây (từ bảng Report)
   */
  async getRecentReports(): Promise<any[]> {
    // Lấy báo cáo từ 90 ngày trước (không giới hạn bởi thời gian, chỉ lấy 15 cái mới nhất)
    const reports = await this.reportModel
      .find()
      .populate('chapterId', 'title number')
      .populate('userId', 'name')
      .populate('storyId', 'title')
      .sort({ createdAt: -1 })
      .limit(15)
      .lean();

    return reports.map(r => ({
      chapter: (r.chapterId as any)?.title ? `Chương ${(r.chapterId as any)?.number}: ${(r.chapterId as any)?.title}` : 'N/A',
      content: r.reason || '',
      reporter: (r.userId as any)?.name || 'Ẩn danh',
      status: r.status === 'pending' ? 'Chờ xử lý' : 'Đã xử lý',
      statusClass: r.status === 'pending' ? 'pending' : 'resolved',
      createdAt: r.createdAt,
    }));
  }

  /**
   * Lấy danh sách truyện cho admin dashboard
   */
  async getAdminStories(status?: string, q?: string, page: number = 1, pageSize: number = 10): Promise<{ data: any[], total: number }> {
    const query: any = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    // Build search filter for MongoDB if possible
    let mongoFilter: any = { ...query };
    if (q && q.trim().length > 0) {
      const qLower = q.trim().toLowerCase();
      mongoFilter.$or = [
        { title: { $regex: qLower, $options: 'i' } },
        { 'authorId.name': { $regex: qLower, $options: 'i' } },
        { 'authorId.author_info.display_name': { $regex: qLower, $options: 'i' } }
      ];
    }

    // Get total count first
    const total = await this.storyModel.countDocuments(mongoFilter);

    // Query paginated results
    const stories = await this.storyModel
      .find(mongoFilter)
      .populate('authorId', 'name author_info.display_name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean();

    const mapped = stories.map((story: any) => ({
      id: story._id.toString(),
      title: story.title,
      author: story.authorId?.author_info?.display_name || story.authorId?.name || 'Ẩn danh',
      category: story.category && story.category.length > 0 ? story.category[0] : 'N/A',
      status: story.status,
      createdAt: story.createdAt ? new Date(story.createdAt).toLocaleDateString('vi-VN') : 'N/A',
    }));

    return { data: mapped, total };
  }
  
  /** Approve a story (set status to 'published') */
  async approveStory(id: string): Promise<boolean> {
    const res = await this.storyModel.updateOne({ _id: id }, { $set: { status: 'published' } }).exec();
    return res.matchedCount > 0;
  }
  
  /** Reject a story (set status to 'rejected') */
  async rejectStory(id: string): Promise<boolean> {
    const res = await this.storyModel.updateOne({ _id: id }, { $set: { status: 'rejected' } }).exec();
    return res.matchedCount > 0;
  }
  
  /** Delete a story */
  async deleteStory(id: string): Promise<boolean> {
    const res = await this.storyModel.deleteOne({ _id: id }).exec();
    return res.deletedCount > 0;
  }

  /**
   * Lấy danh sách chương cho admin dashboard với phân trang
   */
  async getAdminChapters(status?: string, q?: string, page: number = 1, pageSize: number = 10): Promise<{ data: any[], total: number }> {
    const query: any = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    // Get total count first
    const total = await this.chapterModel.countDocuments(query);

    // Query paginated results without search filter (will filter after populate)
    const chapters = await this.chapterModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean();

    // Populate story and author info manually since storyId is a string
    let enrichedChapters: any[] = [];
    for (const chapter of chapters) {
      let storyTitle = 'N/A';
      let authorName = 'Ẩn danh';

      if (chapter.storyId) {
        try {
          const story = await this.storyModel.findById(chapter.storyId).populate('authorId', 'name author_info.display_name').lean();
          if (story) {
            storyTitle = story.title;
            authorName = (story.authorId as any)?.author_info?.display_name || (story.authorId as any)?.name || 'Ẩn danh';
          }
        } catch (e) {
          // Silent fail
        }
      }

      enrichedChapters.push({
        id: chapter._id.toString(),
        title: chapter.title,
        story: storyTitle,
        author: authorName,
        status: chapter.status || 'draft',
        createdAt: (chapter as any).createdAt ? new Date((chapter as any).createdAt).toLocaleDateString('vi-VN') : 'N/A',
        updatedAt: (chapter as any).updatedAt ? new Date((chapter as any).updatedAt).toLocaleDateString('vi-VN') : 'N/A',
      });
    }

    // Filter by search query if provided
    if (q && q.trim().length > 0) {
      const qLower = q.trim().toLowerCase();
      enrichedChapters = enrichedChapters.filter(ch => 
        ch.title.toLowerCase().includes(qLower) ||
        ch.story.toLowerCase().includes(qLower) ||
        ch.author.toLowerCase().includes(qLower)
      );
    }

    return { data: enrichedChapters, total };
  }

  /** Approve a chapter (set status to 'published') */
  async approveChapter(id: string): Promise<boolean> {
    const res = await this.chapterModel.updateOne({ _id: id }, { $set: { status: 'published' } }).exec();
    return res.matchedCount > 0;
  }

  /** Reject a chapter (set status to 'rejected') */
  async rejectChapter(id: string): Promise<boolean> {
    const res = await this.chapterModel.updateOne({ _id: id }, { $set: { status: 'rejected' } }).exec();
    return res.matchedCount > 0;
  }

  /** Delete a chapter */
  async deleteChapter(id: string): Promise<boolean> {
    const res = await this.chapterModel.deleteOne({ _id: id }).exec();
    return res.deletedCount > 0;
  }

  /**
   * Lấy danh sách người dùng cho admin dashboard với phân trang
   */
  async getAdminUsers(role?: string, q?: string, page: number = 1, pageSize: number = 10): Promise<{ data: any[], total: number }> {
    const query: any = {};
    if (role && role !== 'all') {
      query.role = role;
    }

    // Get total count first
    const total = await this.userModel.countDocuments(query);

    // Query paginated results
    const users = await this.userModel
      .find(query)
      .select('_id name email role isLocked createdAt')
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean();

    let mappedUsers = users.map((user: any) => ({
      id: user._id.toString(),
      name: user.name || 'N/A',
      email: user.email || 'N/A',
      role: user.role || 'user',
      isLocked: user.isLocked || false,
      createdAt: user.createdAt ? new Date(user.createdAt).toLocaleDateString('vi-VN') : 'N/A',
    }));

    // Filter by search query if provided
    if (q && q.trim().length > 0) {
      const qLower = q.trim().toLowerCase();
      mappedUsers = mappedUsers.filter(u =>
        u.name.toLowerCase().includes(qLower) ||
        u.email.toLowerCase().includes(qLower)
      );
    }

    return { data: mappedUsers, total };
  }

  /** Lock a user account */
  async lockUser(id: string): Promise<boolean> {
    const res = await this.userModel.updateOne({ _id: id }, { $set: { isLocked: true } }).exec();
    return res.matchedCount > 0;
  }

  /** Unlock a user account */
  async unlockUser(id: string): Promise<boolean> {
    const res = await this.userModel.updateOne({ _id: id }, { $set: { isLocked: false } }).exec();
    return res.matchedCount > 0;
  }

  /** Demote author to user (remove author role) */
  async demoteAuthor(id: string): Promise<boolean> {
    const res = await this.userModel.updateOne({ _id: id }, { $set: { role: 'user' } }).exec();
    return res.matchedCount > 0;
  }

  /**
   * Lấy danh sách báo cáo cho admin dashboard với phân trang
   */
  async getAdminReports(status?: string, q?: string, page: number = 1, pageSize: number = 10): Promise<{ data: any[], total: number }> {
    const query: any = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    // Get total count first
    const total = await this.reportModel.countDocuments(query);

    // Query paginated results
    const reports = await this.reportModel
      .find(query)
      .populate('storyId', 'title')
      .populate('chapterId', 'title number')
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean();

    let mappedReports = reports.map((report: any) => ({
      id: report._id.toString(),
      story: (report.storyId as any)?.title || 'N/A',
      chapter: (report.chapterId as any)?.title ? `Chương ${(report.chapterId as any)?.number}: ${(report.chapterId as any)?.title}` : 'N/A',
      reporter: (report.userId as any)?.name || 'Ẩn danh',
      reason: report.reason || 'N/A',
      status: report.status || 'pending',
      createdAt: report.createdAt ? new Date(report.createdAt).toLocaleDateString('vi-VN') : 'N/A',
    }));

    // Filter by search query if provided (search in story, chapter, reason, or reporter)
    if (q && q.trim().length > 0) {
      const qLower = q.trim().toLowerCase();
      mappedReports = mappedReports.filter(r =>
        r.story.toLowerCase().includes(qLower) ||
        r.chapter.toLowerCase().includes(qLower) ||
        r.reporter.toLowerCase().includes(qLower) ||
        r.reason.toLowerCase().includes(qLower)
      );
    }

    return { data: mappedReports, total };
  }

  /** Mark report as resolved */
  async resolveReport(id: string): Promise<boolean> {
    const res = await this.reportModel.updateOne({ _id: id }, { $set: { status: 'resolved' } }).exec();
    return res.matchedCount > 0;
  }

  /** Mark report as pending */
  async pendingReport(id: string): Promise<boolean> {
    const res = await this.reportModel.updateOne({ _id: id }, { $set: { status: 'pending' } }).exec();
    return res.matchedCount > 0;
  }

  /** Get pending author requests for admin review */
  async getAdminAuthorRequests(page: number = 1, pageSize: number = 10): Promise<{ data: any[], total: number }> {
    // Only show pending requests
    const query = { status: 'pending' };
    
    const total = await this.authorRequestModel.countDocuments(query);

    const requests = await this.authorRequestModel
      .find(query)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean();

    const mappedRequests = requests.map((req: any) => ({
      id: req._id.toString(),
      userId: req.userId?._id?.toString() || '',
      userName: req.userId?.name || 'N/A',
      userEmail: req.userId?.email || 'N/A',
      message: req.message || 'N/A',
      createdAt: req.createdAt ? new Date(req.createdAt).toLocaleDateString('vi-VN') : 'N/A',
      status: req.status,
    }));

    return { data: mappedRequests, total };
  }

  /** Approve author request */
  async approveAuthorRequest(id: string): Promise<boolean> {
    try {
      const req = await this.authorRequestModel.findById(id);
      if (!req) return false;

      // Update user role to author
      await this.userModel.updateOne({ _id: req.userId }, { $set: { role: 'author' } });

      // Update request status to approved
      const res = await this.authorRequestModel.updateOne({ _id: id }, { $set: { status: 'approved' } });
      return res.matchedCount > 0;
    } catch (e) {
      console.error('Approve author request error:', e);
      return false;
    }
  }

  /** Reject author request */
  async rejectAuthorRequest(id: string): Promise<boolean> {
    const res = await this.authorRequestModel.updateOne({ _id: id }, { $set: { status: 'rejected' } }).exec();
    return res.matchedCount > 0;
  }
}