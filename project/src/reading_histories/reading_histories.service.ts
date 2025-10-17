import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ReadingHistory } from './schemas/reading_histories.schema';
import { CreateReadingHistoryDto } from './dto/create-reading_history.dto';
import { UpdateReadingHistoryDto } from './dto/update-reading_history.dto';

@Injectable()
export class ReadingHistoriesService {
  constructor(
    @InjectModel(ReadingHistory.name)
    private readonly readingHistoryModel: Model<ReadingHistory>,
  ) {}

  async create(dto: CreateReadingHistoryDto): Promise<ReadingHistory> {
    const history = new this.readingHistoryModel(dto);
    return history.save();
  }

  async findAll(): Promise<ReadingHistory[]> {
    return this.readingHistoryModel
      .find()
      .populate('userId', 'name email')
      .populate('storyId', 'title')
      .populate('lastChapterId', 'title number')
      .exec();
  }

  async findOne(id: string): Promise<ReadingHistory> {
    const history = await this.readingHistoryModel
      .findById(id)
      .populate('userId', 'name email')
      .populate('storyId', 'title')
      .populate('lastChapterId', 'title number')
      .exec();

    if (!history) throw new NotFoundException('Reading history not found');
    return history;
  }

  async update(
    id: string,
    dto: UpdateReadingHistoryDto,
  ): Promise<ReadingHistory> {
    const updated = await this.readingHistoryModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Reading history not found');
    return updated;
  }

  async remove(id: string): Promise<void> {
    const result = await this.readingHistoryModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('Reading history not found');
  }
  // 🟦 Lấy lịch sử đọc của 1 user
  async findByUser(userId: string): Promise<ReadingHistory[]> {
    return this.readingHistoryModel
      .find({ userId })
      .sort({ lastReadAt: -1 })
      .populate('storyId', 'title slug coverUrl')
      .populate('lastChapterId', 'title number')
      .exec();
  }

  // 🟧 Cập nhật tiến độ đọc (khi người dùng đọc xong chapter)
  async updateProgress(
    userId: string,
    storyId: string,
    dto: UpdateReadingHistoryDto,
  ) {
    return this.readingHistoryModel.findOneAndUpdate(
      { userId, storyId },
      { ...dto, lastReadAt: new Date() },
      { new: true, upsert: true },
    );
  }
}
