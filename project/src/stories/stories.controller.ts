import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Query,
  Headers,
} from '@nestjs/common';
import { StoriesService } from './stories.service';
import { CreateStoryDto } from './dto/create-story.dto';
import { UpdateStoryDto } from './dto/update-story.dto';

@Controller('api/stories')
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Post()
  create(@Body() dto: CreateStoryDto) {
    return this.storiesService.create(dto);
  }

  @Get('filter')
  async filterStories(
    @Query('sortBy') sortBy = 'lastUpdated',
    @Query('order') order = 'desc',
    @Query('status') status = 'all',
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Headers('accept') accept?: string, // ✅ THÊM để debug
  ) {
    console.log('📨 Filter request:', { sortBy, order, status, page, limit });
    console.log('📨 Accept header:', accept);

    const result = await this.storiesService.filterStories({
      sortBy,
      order,
      status,
      page: Number(page),
      limit: Number(limit),
    });

    console.log('📤 Returning:', result);
    return result; // ✅ NestJS tự động parse thành JSON
  }

  @Get()
  findAll(@Query('skip') skip = 0, @Query('limit') limit = 20) {
    return this.storiesService.findAll(Number(skip), Number(limit));
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.storiesService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStoryDto) {
    return this.storiesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.storiesService.remove(id);
  }
}
