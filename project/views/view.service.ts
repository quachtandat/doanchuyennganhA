import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, Document } from 'mongoose';
import { Story, StoryDocument } from '../src/stories/schemas/stories.schema';
import { Chapter, ChapterDocument } from '../src/chapters/schemas/chapters.schema';
import { User, UserDocument } from '../src/users/schemas/user.schema';
import { ReadingHistory } from '../src/reading_histories/schemas/reading_histories.schema';
import { Purchase } from '../src/purchases/schemas/purchases.schema';

type ReadingHistoryDocument = ReadingHistory & Document;
type PurchaseDocument = Purchase & Document;

@Injectable()
export class ViewService {
  constructor(
    @InjectModel(Story.name) private readonly storyModel: Model<StoryDocument>,
    @InjectModel(Chapter.name) private readonly chapterModel: Model<ChapterDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(ReadingHistory.name) private readonly readingHistoryModel: Model<ReadingHistoryDocument>,
    @InjectModel(Purchase.name) private readonly purchaseModel: Model<PurchaseDocument>,
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
   * Lấy truyện hot (top 5 lượt truy cập cao nhất)
   */
  async getHotStories(): Promise<any[]> {
    // Nếu không có reading history, lấy truyện mới nhất làm hot stories
    const readingHistoryCount = await this.readingHistoryModel.countDocuments();
    console.log(`[HOT STORIES] Total reading history: ${readingHistoryCount}`);
    
    if (readingHistoryCount === 0) {
      console.log('[HOT STORIES] No reading history, using fallback');
      // Fallback: lấy truyện mới nhất nếu không có reading history
      const stories = await this.storyModel
        .find({ status: 'published' })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

      return stories.map((story, index) => ({
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

    // Sử dụng aggregation với xử lý cả string và ObjectId
    // Tạm thời bỏ filter date để test với data cũ
    const sevenDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 ngày thay vì 7 ngày
    console.log(`[HOT STORIES] Looking for history after: ${sevenDaysAgo}`);
    
    const results = await this.readingHistoryModel
      .aggregate([
        { $match: { lastReadAt: { $gte: sevenDaysAgo } } },
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

    console.log(`[HOT STORIES] Aggregation found ${results.length} results`);
    console.log('[HOT STORIES] Results:', results);

    // Nếu không có kết quả từ reading history, fallback về truyện mới nhất
    if (results.length === 0) {
      console.log('[HOT STORIES] No aggregation results, using fallback');
      const stories = await this.storyModel
        .find({ status: 'published' })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

      return stories.map((story, index) => ({
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

    console.log('[HOT STORIES] Using aggregation results');
    return results.map((story) => ({
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
          latestChapterNumber: { $first: '$number' },
        },
      },
    ]);

    const chapterMap = latestChapters.reduce((map, chapter) => {
      map.set(chapter._id.toString(), chapter.latestChapterNumber);
      return map;
    }, new Map<string, number>());

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
      latestChapter: chapterMap.get(story._id.toString()) || 0,
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
    const authorIds = await this.userModel.find({
      $or: [
        { name: searchRegex },
        { 'author_info.display_name': searchRegex }
      ]
    }).distinct('_id');
    
    const stories = await this.storyModel
      .find({
        status: 'published',
        $or: [
          { title: searchRegex },
          { 'authorId': { $in: authorIds } }
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
      histories.map(async (history) => {
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
          progress,
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
}