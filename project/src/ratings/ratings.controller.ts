import { Controller, Post, Param, Body, UseGuards, Request, Get } from '@nestjs/common';
import { RatingsService } from './ratings.service';
import { CreateRatingDto } from './dto/create-rating.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('stories')
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  // POST /stories/:id/rating
  @UseGuards(JwtAuthGuard)
  @Post(':id/rating')
  async rate(@Param('id') id: string, @Body() dto: CreateRatingDto, @Request() req) {
    const userId = req.user.userId;
    const data = await this.ratingsService.submitRating(id, userId, dto.rating);
    return { average: data.average, count: data.count };
  }

  // GET /stories/:id/rating - return current user's rating + aggregate
  @UseGuards(JwtAuthGuard)
  @Get(':id/rating')
  async myRating(@Param('id') id: string, @Request() req) {
    const userId = req.user.userId;
    return this.ratingsService.getUserRating(id, userId);
  }
}
