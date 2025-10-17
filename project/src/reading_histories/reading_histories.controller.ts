import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
} from '@nestjs/common';
import { ReadingHistoriesService } from './reading_histories.service';
import { CreateReadingHistoryDto } from './dto/create-reading_history.dto';
import { UpdateReadingHistoryDto } from './dto/update-reading_history.dto';

@Controller('reading-histories')
export class ReadingHistoriesController {
  constructor(private readonly service: ReadingHistoriesService) {}

  @Post()
  create(@Body() dto: CreateReadingHistoryDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateReadingHistoryDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Get('user/:userId')
  findByUser(@Param('userId') userId: string) {
    return this.service.findByUser(userId);
  }
}
