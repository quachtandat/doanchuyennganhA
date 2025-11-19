import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Chapter, ChapterDocument } from './schemas/chapters.schema';
import { Purchase } from '../purchases/schemas/purchases.schema';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';

@Injectable()
export class ChaptersService {
  constructor(
    @InjectModel(Chapter.name)
    private readonly chapterModel: Model<ChapterDocument>,
    @InjectModel(Purchase.name)
    private readonly purchaseModel: Model<Purchase>,
  ) {}

  async create(createChapterDto: CreateChapterDto): Promise<Chapter> {
    const newChapter = new this.chapterModel(createChapterDto);
    return newChapter.save();
  }

  async findAll(skip = 0, limit = 20, q?: string, storyTitle?: string): Promise<any[]> {
    const filter: any = {};
    if (q && q.trim()) {
      filter.title = { $regex: q.trim(), $options: 'i' };
    }

    // If storyTitle filter provided, find matching story ids first
    if (storyTitle && storyTitle.trim()) {
      const storyModel = this.chapterModel.db.model('Story');
      const matched = await storyModel
        .find({ title: { $regex: storyTitle.trim(), $options: 'i' } })
        .select('_id')
        .limit(200)
        .lean()
        .exec();
      const ids = (matched || []).map((s: any) => s._id);
      filter.storyId = { $in: ids };
    }

    return this.chapterModel
      .find(filter)
      .skip(skip)
      .limit(limit)
      .populate('storyId', 'title slug')
      .exec();
  }

  async findOne(id: string): Promise<any> {
    const chapter = await this.chapterModel
      .findById(id)
      .populate('storyId', 'title slug')
      .exec();
    if (!chapter) throw new NotFoundException('Chapter not found');
    return chapter;
  }

  /**
   * Find chapter with purchase status for a specific user
   */
  async findOneWithPurchaseStatus(
    chapterId: string,
    userId?: string,
  ): Promise<any> {
    const chapter = await this.findOne(chapterId);

    // If chapter is not VIP, user can read it
    if (!chapter.isVip) {
      return {
        ...chapter.toObject(),
        isPurchased: true,
      };
    }

    // If no user is logged in, chapter is locked
    if (!userId) {
      return {
        ...chapter.toObject(),
        isPurchased: false,
      };
    }

    // Check if user has purchased this chapter
    const purchase = await this.purchaseModel.findOne({
      userId: new Types.ObjectId(userId),
      chapterId: new Types.ObjectId(chapterId),
      status: 'completed',
    });

    return {
      ...chapter.toObject(),
      isPurchased: !!purchase,
    };
  }

  async update(
    id: string,
    updateChapterDto: UpdateChapterDto,
  ): Promise<Chapter> {
    const updated = await this.chapterModel
      .findByIdAndUpdate(id, updateChapterDto, { new: true })
      .populate('storyId', 'title slug')
      .exec();
    if (!updated) throw new NotFoundException('Chapter not found');
    return updated;
  }

  async remove(id: string): Promise<void> {
    const result = await this.chapterModel.findByIdAndDelete(id);
    if (!result) throw new NotFoundException('Chapter not found');
  }
}
