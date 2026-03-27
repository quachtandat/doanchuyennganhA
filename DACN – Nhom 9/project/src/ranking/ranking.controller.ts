import { Controller, Get, Query, Render } from '@nestjs/common';
import { RankingService } from './ranking.service';

@Controller('ranking')
export class RankingController {
  constructor(private readonly rankingService: RankingService) {}

  @Get()
  @Render('ranking')
  async getRanking(@Query('type') type?: string, @Query('page') page?: string) {
    const rankingType = type || 'day';
    const currentPage = page ? parseInt(page, 10) : 1;
    const limit = 20;

    console.log('🔍 Fetching ranking:', { rankingType, currentPage, limit }); // ✅ Debug

    try {
      const result = await this.rankingService.getTopStories(
        rankingType as 'day' | 'month' | 'alltime',
        currentPage,
        limit,
      );

      console.log('📊 Result:', {
        storiesCount: result.stories.length,
        total: result.total,
        totalPages: result.totalPages,
      }); // Debug

      const pagination = this.buildPagination(
        currentPage,
        result.totalPages,
        result.total,
      );

      return {
        title: 'Bảng Xếp Hạng - Sưu Truyện',
        stories: result.stories,
        pagination,
        currentType: rankingType,
      };
    } catch (error) {
      console.error('❌ Error fetching ranking:', error); // ✅ Debug
      return {
        title: 'Bảng Xếp Hạng - Sưu Truyện',
        stories: [],
        pagination: null,
        currentType: rankingType,
      };
    }
  }

  private buildPagination(
    currentPage: number,
    totalPages: number,
    total: number,
  ) {
    const maxVisible = 5;
    const pages: Array<{ number: number; active: boolean }> = [];

    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push({
        number: i,
        active: i === currentPage,
      });
    }

    return {
      currentPage,
      totalPages,
      total,
      pages,
      isFirstPage: currentPage === 1,
      isLastPage: currentPage === totalPages,
      prevPage: Math.max(1, currentPage - 1),
      nextPage: Math.min(totalPages, currentPage + 1),
      showFirst: startPage > 1,
      showLast: endPage < totalPages,
      showFirstDots: startPage > 2,
      showLastDots: endPage < totalPages - 1,
    };
  }
}
