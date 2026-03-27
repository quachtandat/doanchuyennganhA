import { Body, Controller, Get, Param, Post, Request, UseGuards, Patch, Delete } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Request() req, @Body() body: { storyId: string; chapterId?: string; content: string }) {
    return this.commentsService.create(req.user.userId, body);
  }

  @Get('story/:storyId')
  findByStory(@Param('storyId') storyId: string) {
    return this.commentsService.findByStory(storyId);
  }

  // Author moderation
  @UseGuards(JwtAuthGuard)
  @Patch(':id/hide')
  async hide(@Request() req, @Param('id') id: string) {
    return this.commentsService.hideByAuthor(id, req.user.userId, true);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/unhide')
  async unhide(@Request() req, @Param('id') id: string) {
    return this.commentsService.hideByAuthor(id, req.user.userId, false);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Request() req, @Param('id') id: string) {
    return this.commentsService.deleteByAuthor(id, req.user.userId);
  }
}


