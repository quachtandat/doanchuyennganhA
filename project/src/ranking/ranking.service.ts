import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Story } from '../stories/schemas/stories.schema';
import { ReadingHistory } from '../reading_histories/schemas/reading_histories.schema';

@Injectable()
export class RankingService {
  constructor(
    @InjectModel(Story.name) private storyModel: Model<Story>,
    @InjectModel(ReadingHistory.name)
    private readingHistoryModel: Model<ReadingHistory>,
  ) {}

  async getTopStories(
    type: 'day' | 'month' | 'alltime',
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = (page - 1) * limit;
    const now = new Date();
    let dateFilter: any = {};

    // Xác định khoảng thời gian dựa vào type
    switch (type) {
      case 'day':
        const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        dateFilter = { lastReadAt: { $gte: dayAgo } };
        break;

      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        dateFilter = { lastReadAt: { $gte: monthAgo } };
        break;

      case 'alltime':
        dateFilter = {}; // Không filter theo thời gian
        break;
    }

    // 1. Aggregate để đếm số lượt đọc theo storyId
    const topStoryIds = await this.readingHistoryModel.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$storyId',
          readCount: { $sum: 1 }, // Đếm số lượt đọc
          lastRead: { $max: '$lastReadAt' }, // Lấy thời gian đọc gần nhất
        },
      },
      { $sort: { readCount: -1, lastRead: -1 } }, // Sắp xếp theo lượt đọc giảm dần
      { $skip: skip },
      { $limit: limit },
    ]);

    // 2. Lấy thông tin chi tiết của stories
    const storyIds = topStoryIds.map((item) => item._id);

    const stories = await this.storyModel
      .find({
        _id: { $in: storyIds },
        status: 'published', // Chỉ lấy truyện đã xuất bản
      })
      .select(
        'title slug coverUrl description category status expectedTotalChapters',
      )
      .lean();

    // 3. Tạo map để match story với readCount
    const readCountMap = new Map(
      topStoryIds.map((item) => [item._id.toString(), item.readCount]),
    );

    // 4. Format kết quả
    const formattedStories = await Promise.all(
      stories.map(async (story: any) => {
        // Đếm số chương
        const chapterCount = await this.storyModel.db
          .collection('chapters')
          .countDocuments({
            storyId: story._id,
            status: 'published',
          });

        const isCompleted = story.expectedTotalChapters
          ? chapterCount >= story.expectedTotalChapters
          : false;

        const readCount = readCountMap.get(story._id.toString()) || 0;

        return {
          id: story._id.toString(),
          title: story.title,
          slug: story.slug,
          coverUrl: story.coverUrl || '/assets/images/default-cover.jpg',
          description: story.description
            ? story.description.substring(0, 150) + '...'
            : 'Chưa có mô tả',
          category: story.category || [],
          status: story.status,
          chapterCount,
          expectedTotalChapters: story.expectedTotalChapters,
          isCompleted,
          statusText: isCompleted ? 'Hoàn thành' : 'Đang ra',
          statusClass: isCompleted ? 'published' : 'pending',
          readCount, // Số lượt đọc
        };
      }),
    );

    // 5. Sắp xếp lại theo thứ tự topStoryIds (để giữ đúng thứ tự ranking)
    const sortedStories = storyIds
      .map((id) => formattedStories.find((s) => s.id === id.toString()))
      .filter(Boolean);

    // 6. Đếm tổng số stories (cho pagination)
    const totalResult = await this.readingHistoryModel.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$storyId' } },
      { $count: 'total' },
    ]);

    const total = totalResult.length > 0 ? totalResult[0].total : 0;
    const totalPages = Math.ceil(total / limit);

    return {
      stories: sortedStories,
      total,
      totalPages,
      currentPage: page,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }
}
