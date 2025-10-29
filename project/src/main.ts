// main.ts

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import hbs from 'hbs'; // Import hbs
import { AppModule } from './app.module';

async function bootstrap() {
  // Dùng NestExpressApplication để bật view engine
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Cấu hình view
  app.setBaseViewsDir(join(process.cwd(), 'views'));
  app.setViewEngine('hbs');

  // 1. ĐĂNG KÝ HELPER "isEven" TẠI ĐÂY (FIX LỖI)
  hbs.registerHelper('isEven', function (index) {
    // Helper kiểm tra index (bắt đầu từ 0) có phải là số chẵn hay không
    return index % 2 === 0;
  });

  // 2. ĐĂNG KÝ HELPER "eq" (equal)
  hbs.registerHelper('eq', function (a, b) {
    return a === b;
  });

  // 3. ĐĂNG KÝ HELPER "lt" (less than)
  hbs.registerHelper('lt', function (a, b) {
    return a < b;
  });

  // 4. ĐĂNG KÝ HELPER "inc" (increment)
  hbs.registerHelper('inc', function (value) {
    return parseInt(value) + 1;
  });

  hbs.registerPartials(join(process.cwd(), 'views', 'partials'));

  app.useStaticAssets(join(process.cwd(), 'assets'), {
    prefix: '/assets/',
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT') || 3000;

  await app.listen(port);
  console.log(`🚀 Server đang chạy tại: http://localhost:${port}`);
}
void bootstrap();
