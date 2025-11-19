import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Param,
  Patch,
} from '@nestjs/common';
import { AuthorRequestsService } from './author_requests.service';
import { CreateAuthorRequestDto } from './dto/create-author-request.dto';
import { UpdateAuthorRequestDto } from './dto/update-author-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('author-requests')
export class AuthorRequestsController {
  constructor(private readonly authorRequestsService: AuthorRequestsService) {}

  // Reader: gửi yêu cầu làm tác giả
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Request() req, @Body() dto: CreateAuthorRequestDto) {
    return this.authorRequestsService.create(req.user.userId, dto);
  }

  // Reader: xem trạng thái yêu cầu của mình
  @UseGuards(JwtAuthGuard)
  @Get('my')
  async myRequests(@Request() req) {
    return this.authorRequestsService.findMy(req.user.userId);
  }

  // Admin: danh sách tất cả yêu cầu
  @Get()
  async findAll() {
    return this.authorRequestsService.findAll();
  }

  // Admin: duyệt hoặc từ chối
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateAuthorRequestDto) {
    return this.authorRequestsService.updateStatus(id, dto);
  }
}


