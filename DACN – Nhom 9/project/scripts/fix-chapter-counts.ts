// Create a file: scripts/fix-chapter-counts.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

async function fixChapterCounts() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const storyModel = app.get('StoryModel');
  const chapterModel = app.get('ChapterModel');

  const stories = await storyModel.find();

  for (const story of stories) {
    const count = await chapterModel.countDocuments({
      storyId: String(story._id),
      status: 'published',
      isHidden: { $ne: true },
    });

    await storyModel.updateOne(
      { _id: story._id },
      { $set: { chapterCount: count } },
    );

    console.log(`✅ Story "${story.title}": ${count} chapters`);
  }

  console.log('✅ All done!');
  await app.close();
}

fixChapterCounts();
