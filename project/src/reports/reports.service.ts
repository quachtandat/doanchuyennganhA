import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Report } from './schemas/reports.schema';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Report.name)
    private readonly reportModel: Model<Report>,
  ) {}

  async create(dto: CreateReportDto): Promise<Report> {
    const report = new this.reportModel(dto);
    return report.save();
  }

  async findAll(): Promise<Report[]> {
    return this.reportModel
      .find()
      .populate('userId', 'name email')
      .populate('storyId', 'title slug')
      .populate('chapterId', 'title number')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string): Promise<Report> {
    const report = await this.reportModel
      .findById(id)
      .populate('userId', 'name email')
      .populate('storyId', 'title slug')
      .populate('chapterId', 'title number')
      .exec();

    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  async update(id: string, dto: UpdateReportDto): Promise<Report> {
    const updated = await this.reportModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();

    if (!updated) throw new NotFoundException('Report not found');
    return updated;
  }

  async remove(id: string): Promise<void> {
    const result = await this.reportModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('Report not found');
  }

  // 🟦 Lấy tất cả report của 1 truyện
  async findByStory(storyId: string): Promise<Report[]> {
    return this.reportModel
      .find({ storyId })
      .populate('userId', 'name email')
      .populate('chapterId', 'title number')
      .sort({ createdAt: -1 })
      .exec();
  }
}
