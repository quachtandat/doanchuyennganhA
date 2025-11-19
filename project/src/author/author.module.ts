import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthorController } from './author.controller';
import { Story, StorySchema } from '../stories/schemas/stories.schema';
import { Chapter, ChapterSchema } from '../chapters/schemas/chapters.schema';
import { Comment, CommentSchema } from '../comments/schemas/comment.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Story.name, schema: StorySchema },
      { name: Chapter.name, schema: ChapterSchema },
      { name: Comment.name, schema: CommentSchema },
    ]),
  ],
  controllers: [AuthorController],
})
export class AuthorModule {}


