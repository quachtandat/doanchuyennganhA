import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { ChaptersService } from './chapters.service';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Chapter, ChapterDocument } from './schemas/chapters.schema';

@Controller('chapters')
export class ChaptersController {
  constructor(
    private readonly chaptersService: ChaptersService,
    @InjectModel(Chapter.name) private readonly chapterModel: Model<ChapterDocument>,
  ) {}

  @Post()
  create(@Body() createChapterDto: CreateChapterDto) {
    return this.chaptersService.create(createChapterDto);
  }

  @Get()
  findAll(
    @Query('skip') skip = 0,
    @Query('limit') limit = 20,
    @Query('q') q?: string,
    @Query('storyTitle') storyTitle?: string,
  ) {
    return this.chaptersService.findAll(Number(skip), Number(limit), q, storyTitle);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string, @Request() req) {
    return this.chaptersService.findOneWithPurchaseStatus(id, req.user?.userId);
  }

  @Get(':id/public')
  async findOnePublic(@Param('id') id: string) {
    return this.chaptersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateChapterDto: UpdateChapterDto) {
    return this.chaptersService.update(id, updateChapterDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.chaptersService.remove(id);
  }

  // Admin: publish chapter
  @Patch(':id/publish')
  publish(@Param('id') id: string) {
    return this.chapterModel.findByIdAndUpdate(
      id,
      { status: 'published' },
      { new: true },
    );
  }

  // Admin: ẩn/bỏ ẩn
  @Patch(':id/hide')
  hide(@Param('id') id: string) {
    return this.chapterModel.findByIdAndUpdate(
      id,
      { isHidden: true },
      { new: true },
    );
  }

  @Patch(':id/unhide')
  unhide(@Param('id') id: string) {
    return this.chapterModel.findByIdAndUpdate(
      id,
      { isHidden: false },
      { new: true },
    );
  }
}
