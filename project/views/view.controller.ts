// views/view.controller.ts

import {
  Controller,
  Get,
  Render,
  Param,
  NotFoundException,
  Query,
  Req,
  Redirect,
  Post,
  Body,
} from '@nestjs/common';
import type { Request } from 'express';
import { ViewService } from './view.service';

@Controller()
export class ViewController {
  constructor(private readonly viewService: ViewService) {}

  // 🏠 Trang chủ - hiển thị danh sách truyện mới nhất & đã xuất bản
  @Get('/')
  @Render('index')
  async getHome(@Query('key_word') keyWord?: string) {
    if (keyWord && keyWord.trim()) {
      // This should be handled by a separate route or middleware
      // For now, just ignore the search parameter on home page
    }
    const [allCategories, hotStories, newStories, completedStories] =
      await Promise.all([
        this.viewService.getAllCategories(),
        this.viewService.getHotStories(),
        this.viewService.getNewStories(),
        this.viewService.getCompletedStories(),
      ]);

    return {
      categories: allCategories.slice(0, 5),
      allCategories: allCategories,
      hotStories: hotStories,
      newStories: newStories,
      completedStories: completedStories,
    };
  }

  // ------------------------------------------------
  // AUTH PAGES - Trang đăng nhập và đăng ký
  // ------------------------------------------------

  @Get('auth/login')
  @Render('login')
  getLogin() {
    return {};
  }

  @Get('auth/register')
  @Render('register')
  getRegister() {
    return {};
  }

  // ===================================================================
  // 👤 ACCOUNT PAGE - Trang tài khoản
  // ===================================================================

  @Get('account')
  @Render('account')
  async getAccount(@Req() req: Request, @Query('token') token?: string) {
    // Lấy lịch sử đọc của user
    let userId = (req as any).user?.id;
    
    // Nếu không có user từ session, thử lấy từ token
    if (!userId && token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.decode(token);
        userId = decoded?.id || decoded?.userId || decoded?.sub;
      } catch (error) {
        // Silent fail
      }
    }
    
    let readingHistory: any[] = [];
    if (userId) {
      readingHistory = await this.viewService.getUserReadingHistory(userId);
    }

    return {
      readingHistory,
      userId,
    };
  }

  // ===================================================================
  // 🔍 SEARCH - Tìm kiếm truyện
  // ===================================================================

  @Get('search')
  @Render('search')
  async searchStories(@Query('q') query?: string, @Query('key_word') keyWord?: string) {
    // Handle both parameter names for backward compatibility
    const searchQuery = query || keyWord;
    
    if (!searchQuery) {
      return {
        stories: [],
        query: '',
        allCategories: await this.viewService.getAllCategories(),
      };
    }

    const [stories, allCategories] = await Promise.all([
      this.viewService.searchStories(searchQuery),
      this.viewService.getAllCategories(),
    ]);

    return {
      stories,
      query: searchQuery,
      allCategories,
    };
  }

  // ===================================================================
  // 📂 CATEGORY - Trang thể loại
  // ===================================================================

  @Get('category/:categoryName')
  @Render('category')
  async getCategoryStories(@Param('categoryName') categoryName: string) {
    const [stories, allCategories] = await Promise.all([
      this.viewService.getStoriesByCategory(categoryName),
      this.viewService.getAllCategories(),
    ]);

    return {
      categoryName,
      stories,
      allCategories,
    };
  }

  // ------------------------------------------------
  // Trang chi tiết truyện: /story/:slug
  // ------------------------------------------------
  @Get('story/:slug')
  @Render('story')
  async getStoryDetail(@Param('slug') slug: string) {
    const result = await this.viewService.getStoryDetail(slug);
    if (!result) {
      throw new NotFoundException(`Không tìm thấy truyện với slug: ${slug}`);
    }

    return result;
  }
  // ------------------------------------------------
  // Trang đọc chương: /story/:storyId/chapter/:chapterId
  // ------------------------------------------------
  @Get('story/:storyId/chapter/:chapterId')
  @Render('chapter')
  async getChapterDetail(
    @Param('storyId') storyId: string,
    @Param('chapterId') chapterId: string,
    @Req() req: Request,
    @Query('token') token?: string,
  ) {
    let userId = (req as any).user?.id;
    
    // Nếu không có user từ session, thử lấy từ token
    if (!userId && token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.decode(token);
        userId = decoded?.id || decoded?.userId || decoded?.sub;
      } catch (error) {
        // Silent fail
      }
    }
    
    const result = await this.viewService.getChapterDetail(
      storyId,
      chapterId,
      userId,
    );
    if (!result) {
      throw new NotFoundException('Không tìm thấy chương hoặc truyện.');
    }

    return result;
  }

  // ===================================================================
  // 📄 API: Lấy danh sách chương JSON theo truyện
  // ===================================================================
  @Get('api/story/:storyId/chapters')
  async apiGetStoryChapters(@Param('storyId') storyId: string) {
    return await this.viewService.getStoryChapters(storyId);
  }

  // Debug route for hot stories
  @Get('debug/hot-stories')
  async debugHotStories() {
    return await this.viewService.debugHotStories();
  }

  // API endpoint để lấy reading history
  @Get('api/reading-history')
  async getReadingHistory(@Req() req: Request, @Query('token') token?: string) {
    let userId = (req as any).user?.id;
    
    // Nếu không có user từ session, thử lấy từ token
    if (!userId && token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.decode(token);
        userId = decoded?.id || decoded?.userId || decoded?.sub;
      } catch (error) {
        // Silent fail
      }
    }
    
    if (!userId) {
      return { error: 'User not authenticated', readingHistory: [] };
    }
    
    const readingHistory = await this.viewService.getUserReadingHistory(userId);
    return { readingHistory };
  }
}
