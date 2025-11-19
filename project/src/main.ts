// main.ts

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import hbs from 'hbs';
import { AppModule } from './app.module';
import { handlebarsHelpers } from './handlebars-helpers';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // CORS - BẮT BUỘC PHẢI CÓ
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Cấu hình view
  app.setBaseViewsDir(join(process.cwd(), 'views'));
  app.setViewEngine('hbs');

  // HANDLEBARS HELPERS
  Object.keys(handlebarsHelpers).forEach((helperName) => {
    hbs.registerHelper(helperName, handlebarsHelpers[helperName]);
  });

  // Đăng ký partials
  hbs.registerPartials(join(process.cwd(), 'views', 'partials'));

  // Static assets
  app.useStaticAssets(join(process.cwd(), 'assets'), {
    prefix: '/assets/',
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT') || 3000;

  await app.listen(port);
  console.log(`🚀 Server đang chạy tại: http://localhost:${port}`);
}
void bootstrap();
