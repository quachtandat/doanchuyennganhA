// views/view.controller.ts

import {
  Controller,
  Get,
  Render,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, Document } from 'mongoose';

// 1. IMPORT CÁC SCHEMA VÀ DOCUMENTS CẦN THIẾT
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

  // 🏠 Trang chủ - hiển thị danh sách truyện mới nhất & đã xuất bản
  @Get('/')
  @Render('index')
  async getHome() {
    // 1. Lấy tất cả thể loại duy nhất từ các truyện đã xuất bản
    const allCategories: string[] = await this.storyModel.distinct('category', {
      status: 'published',
    });

    // 2. Lấy danh sách Truyện Hot (8 truyện mới nhất đã xuất bản, có ảnh bìa)
    const hotStoriesDocs: LeanStory[] = await this.storyModel
      .find({ status: 'published', coverUrl: { $exists: true, $ne: null } })
      .sort({ createdAt: -1 })
      .limit(8)
      .lean<LeanStory[]>();

    const hotStories: StoryViewModel[] = hotStoriesDocs.map((story, index) => ({
      id: story._id.toString(),
      title: story.title,
      slug: story.slug,
      image: story.coverUrl || '',
      isFull: false,
      isHot: true,
      isNew: index < 3,
      categories: story.category,
    }));

    // 3. Lấy danh sách Truyện Mới (10 truyện đã xuất bản, kèm chương mới nhất)
    const newStoriesDocs: LeanStory[] = await this.storyModel
      .find({ status: 'published' })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean<LeanStory[]>();

    // Lấy ID truyện để tìm chương mới nhất
    const storyIdsAsString = newStoriesDocs.map((story) =>
      story._id.toString(),
    );

    // Tìm chương mới nhất cho từng truyện
    const latestChapters =
      await this.chapterModel.aggregate<LatestChapterAggregation>([
        {
          $match: {
            storyId: { $in: storyIdsAsString }, // Dùng Types.ObjectId để match
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

    const newStories: StoryViewModel[] = newStoriesDocs.map((story, index) => ({
      id: story._id.toString(),
      title: story.title,
      slug: story.slug,
      image: story.coverUrl || '',
      isFull: false,
      isHot: false,
      isNew: index < 5,
      categories: story.category,
      latestChapter: chapterMap.get(story._id.toString()) || 0,
    }));

    // 4. Lấy danh sách Truyện Đã Hoàn thành (8 truyện đã xuất bản)
    const completedStoriesDocs: LeanStory[] = await this.storyModel
      .find({
        status: 'published',
        description: { $exists: true, $ne: null },
      })
      .sort({ updatedAt: -1 })
      .limit(8)
      .lean<LeanStory[]>();

    // Lấy tổng số chương cho các truyện đã hoàn thành
    const completedStoryIdsAsString = completedStoriesDocs.map((story) =>
      story._id.toString(),
    );
    const chapterCounts =
      await this.chapterModel.aggregate<ChapterCountAggregation>([
        {
          $match: {
            storyId: { $in: completedStoryIdsAsString },
            status: 'published',
          },
        },
        {
          $group: {
            _id: '$storyId',
            totalChapters: { $count: {} },
          },
        },
      ]);

    const countMap = chapterCounts.reduce((map, count) => {
      map.set(count._id.toString(), count.totalChapters);
      return map;
    }, new Map<string, number>());

    const completedStories: StoryViewModel[] = completedStoriesDocs.map(
      (story) => ({
        id: story._id.toString(),
        title: story.title,
        slug: story.slug,
        image: story.coverUrl || '',
        isFull: true,
        isHot: false,
        isNew: false,
        categories: story.category,
        totalChapters: countMap.get(story._id.toString()) || 0,
      }),
    );

    // Trả về dữ liệu cho Handlebars template
    return {
      categories: allCategories.slice(0, 5),
      allCategories: allCategories,
      hotStories: hotStories,
      newStories: newStories,
      completedStories: completedStories,
    };
  }

  // ------------------------------------------------
  // Trang chi tiết truyện: /story/:slug
  // ------------------------------------------------
  @Get('story/:slug')
  @Render('story')
  async getStoryDetail(
    @Param('slug') slug: string, // <-- tham số vẫn là slug
  ): Promise<StoryPageViewModel> {
    // 🛠️ BƯỚC FIX: TẠO ĐIỀU KIỆN TRUY VẤN LINH HOẠT
    let findCondition: any;
    // Kiểm tra xem tham số có phải là một ObjectId hợp lệ hay không
    const isObjectId = Types.ObjectId.isValid(slug);

    if (isObjectId) {
      // Nếu là ObjectId, tìm kiếm theo _id
      findCondition = {
        _id: new Types.ObjectId(slug),
        status: 'published',
      };
    } else {
      // Nếu không phải, tìm kiếm theo slug
      findCondition = {
        slug: slug,
        status: 'published',
      };
    }
    // 1. TRUY VẤN DỮ LIỆU CẦN THIẾT
    const [storyDoc, topStoriesDay, allCategories] = await Promise.all([
      this.storyModel
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        .findOne(findCondition) // ✅ Dùng điều kiện đã tạo
        .populate('authorId')
        .lean<PopulatedStoryLean>()
        .exec(),

      this.getTopStories(7), // Top 7 ngày
      this.getAllUniqueCategories(), // Tất cả danh mục
    ]);

    if (!storyDoc) {
      // Nếu vẫn không tìm thấy, thông báo 404
      throw new NotFoundException(`Không tìm thấy truyện với slug: ${slug}`);
    }

    // Lấy Chapters (Phải chạy sau khi có storyDoc)
    const chapterDocs = await this.chapterModel
      .find({
        storyId: storyDoc._id.toString(),
        status: 'published',
      })
      .select('_id title number')
      .sort({ number: 1 })
      .lean<ChapterLean[]>()
      .exec();

    console.log(`[DEBUG] Story ID: ${storyDoc._id.toString()}`);
    console.log(
      `[DEBUG] Số lượng chương published tìm thấy: ${chapterDocs.length}`,
    );
    if (chapterDocs.length === 0) {
      console.log(
        '[DEBUG] KHÔNG TÌM THẤY CHƯƠNG NÀO. VUI LÒNG KIỂM TRA STATUS CỦA CHAPTERS TRONG DB.',
      );
    }
    // 2. XỬ LÝ VÀ TẠO VIEW MODEL
    const chapters: ChapterViewModel[] = chapterDocs.map((chap) => ({
      id: chap._id.toString(),
      title: `Chương ${chap.number}: ${chap.title}`,
    }));

    let authorName = 'Ẩn danh';
    const authorObject = storyDoc.authorId as UserDocument;
    if (
      authorObject &&
      authorObject.author_info &&
      authorObject.author_info.display_name
    ) {
      authorName = authorObject.author_info.display_name;
    } else if (authorObject && authorObject.name) {
      authorName = authorObject.name;
    }

    const storyViewModel: StoryDetailViewModel = {
      id: storyDoc._id.toString(),
      title: storyDoc.title,
      slug: storyDoc.slug,
      author: authorName,
      image: storyDoc.coverUrl,
      description: storyDoc.description,
      categories: storyDoc.category,
      status: storyDoc.status === 'completed' ? 'Đã hoàn thành' : 'Đang ra',
      rating: 9.5,
      ratingCount: 1200,
      chapters: chapters,
    };

    // 3. Lấy thêm dữ liệu Top Stories cho Tháng và All Time (Chạy song song)
    const [topStoriesMonth, topStoriesAllTime] = await Promise.all([
      this.getTopStories(30), // Top 30 ngày
      this.getTopStories(0), // Top All Time (days = 0)
    ]);

    // 4. TRẢ VỀ VIEW MODEL TỔNG THỂ
    return {
      story: storyViewModel,
      topStoriesDay: topStoriesDay,
      topStoriesMonth: topStoriesMonth,
      topStoriesAllTime: topStoriesAllTime,
      allCategories: allCategories,
    };
  }
  // ------------------------------------------------
  // Trang đọc chương: /story/:storyId/chapter/:chapterId
  // ------------------------------------------------
  @Get('story/:storyId/chapter/:chapterId')
  @Render('chapter')
  async getChapterDetail(
    @Param('storyId') storyId: string,
    @Param('chapterId') chapterId: string,
    // 💡 GIẢ ĐỊNH: Lấy userId từ Request/Session/AuthGuard
    // Bạn cần thay thế 'unknown' bằng cách lấy userId thực tế
    // Ví dụ: @Req() req: Request
    // const userId = req.user.id;
    // Tạm thời để null nếu không có auth
    userId: string | null = null,
  ): Promise<ChapterReadPageViewModel> {
    // 1. TÌM CHƯƠNG HIỆN TẠI, TRUYỆN LIÊN QUAN, và CÁC CHƯƠNG ĐIỀU HƯỚNG
    const [currentChapterDoc, storyDoc] = await Promise.all([
      this.chapterModel.findById(chapterId).lean<ChapterFullLean>(),
      // ... (storyDoc query giữ nguyên)
      this.storyModel
        .findById(storyId)
        .select('title status')
        .lean<StoryIdAndStatusLean>(),
    ]);

    if (
      !currentChapterDoc ||
      !storyDoc ||
      storyDoc.status !== 'published' ||
      currentChapterDoc.status !== 'published' ||
      currentChapterDoc.storyId.toString() !== storyId
    ) {
      throw new NotFoundException('Không tìm thấy chương hoặc truyện.');
    }

    const query = { storyId: currentChapterDoc.storyId, status: 'published' };
    const [prevChapterDoc, nextChapterDoc] = await Promise.all([
      this.chapterModel
        .findOne({ ...query, number: { $lt: currentChapterDoc.number } })
        .select('_id')
        .sort({ number: -1 })
        .lean<IdOnlyLean>()
        .exec(),
      this.chapterModel
        .findOne({ ...query, number: { $gt: currentChapterDoc.number } })
        .select('_id')
        .sort({ number: 1 })
        .lean<IdOnlyLean>()
        .exec(),
    ]);

    // 2. LOGIC KIỂM TRA MUA CHƯƠNG (CHỈ ÁP DỤNG CHO CHƯƠNG VIP)
    let isPurchased = false;
    let chapterContent =
      currentChapterDoc.content || 'Nội dung chương đang được cập nhật.';

    if (currentChapterDoc.isVip) {
      if (!userId) {
        // Nếu là VIP và chưa đăng nhập -> Hiển thị cảnh báo mua
        isPurchased = false;
        chapterContent =
          'Chương này là Chương VIP. Vui lòng đăng nhập để xem hoặc mua chương.';
      } else {
        // Nếu là VIP và đã đăng nhập -> Kiểm tra Purchase
        const purchase = await this.purchaseModel
          .findOne({
            userId: new Types.ObjectId(userId), // Chuyển string userId sang ObjectId
            chapterId: currentChapterDoc._id,
            status: 'completed', // Chỉ chấp nhận trạng thái hoàn thành
          })
          .exec();

        isPurchased = !!purchase; // Nếu tìm thấy Purchase -> đã mua

        if (!isPurchased) {
          // Nếu chưa mua -> Khóa nội dung, hiển thị thông báo mua
          chapterContent = `Chương này là Chương VIP với giá ${currentChapterDoc.priceCoins} Coins. Vui lòng mua để mở khóa nội dung.`;
        }
        // Nếu đã mua (isPurchased = true), chapterContent sẽ giữ nguyên nội dung gốc
      }
    } else {
      // Chương FREE, luôn mở khóa
      isPurchased = true;
    }

    // 3. TẠO VIEW MODEL VÀ TRẢ VỀ

    const storyViewModel: ChapterReadStoryViewModel = {
      id: storyDoc._id.toString(),
      title: storyDoc.title,
    };

    const chapterViewModel: ChapterReadDetailViewModel = {
      id: currentChapterDoc._id.toString(),
      title: `Chương ${currentChapterDoc.number}: ${currentChapterDoc.title}`,
      content: chapterContent, // ✅ Nội dung đã được xử lý (VIP/Free)

      isVip: currentChapterDoc.isVip, // ✅ Trạng thái VIP
      priceCoins: currentChapterDoc.priceCoins, // ✅ Giá
      isPurchased: isPurchased, // ✅ Trạng thái đã mua

      prevChapter: prevChapterDoc ? prevChapterDoc._id.toString() : null,
      nextChapter: nextChapterDoc ? nextChapterDoc._id.toString() : null,
    };

    return {
      story: storyViewModel,
      chapter: chapterViewModel,
    };
  }
}
