import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Chapter, ChapterDocument } from './schemas/chapters.schema';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';

@Injectable()
export class ChaptersService {
  constructor(
    @InjectModel(Chapter.name)
    private readonly chapterModel: Model<ChapterDocument>,
  ) {}

  async create(createChapterDto: CreateChapterDto): Promise<Chapter> {
    const newChapter = new this.chapterModel(createChapterDto);
    return newChapter.save();
  }

  async findAll(): Promise<any[]> {
    return this.chapterModel
      .find()
      .populate('storyId', 'title slug') // populate tên truyện
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
