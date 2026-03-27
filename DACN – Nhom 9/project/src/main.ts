// main.ts

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join, relative, extname } from 'path';
import { readdirSync, statSync, readFileSync } from 'fs';
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

  // Register partials recursively so nested partials keep their folder path
  const partialsRoot = join(process.cwd(), 'views', 'partials');
  function registerPartialsRecursive(dir: string) {
    const entries = readdirSync(dir);
    for (const name of entries) {
      const full = join(dir, name);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        registerPartialsRecursive(full);
      } else if (stat.isFile()) {
        const rel = relative(partialsRoot, full).replace(/\\/g, '/');
        const key = rel.replace(extname(rel), '');
        const content = readFileSync(full, 'utf8');
        hbs.registerPartial(key, content);
      }
    }
  }

  // Đăng ký partials
  registerPartialsRecursive(partialsRoot);

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
