import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Comment, CommentDocument } from './schemas/comment.schema';

@Injectable()
export class CommentsService {
  constructor(
    @InjectModel(Comment.name)
    private readonly commentModel: Model<CommentDocument>,
  ) {}

  async create(userId: string, body: { storyId: string; chapterId?: string; content: string }) {
    const comment = new this.commentModel({
      userId: new Types.ObjectId(userId),
      storyId: new Types.ObjectId(body.storyId),
      chapterId: body.chapterId ? new Types.ObjectId(body.chapterId) : undefined,
      content: body.content,
    });
    return comment.save();
  }

  async findByStory(storyId: string) {
    return this.commentModel
      .find({ storyId: new Types.ObjectId(storyId) })
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByAuthorStories(authorId: string) {
    // This requires aggregation since Comment doesn't hold authorId; join with stories
    return this.commentModel.aggregate([
      {
        $lookup: {
          from: 'stories',
          localField: 'storyId',
          foreignField: '_id',
          as: 'story',
        },
      },
      { $unwind: '$story' },
      { $match: { 'story.authorId': new Types.ObjectId(authorId) } },
      { $sort: { createdAt: -1 } },
      {
        $project: {
          content: 1,
          storyId: 1,
          chapterId: 1,
          userId: 1,
          createdAt: 1,
          storyTitle: '$story.title',
        },
      },
    ]);
  }

  async hideByAuthor(commentId: string, authorId: string, hidden: boolean) {
    const c = await this.commentModel.findById(commentId);
    if (!c) return null;
    // verify ownership via lookup
    const match = await this.commentModel.aggregate([
      { $match: { _id: new Types.ObjectId(commentId) } },
      { $lookup: { from: 'stories', localField: 'storyId', foreignField: '_id', as: 'story' } },
      { $unwind: '$story' },
      { $match: { 'story.authorId': new Types.ObjectId(authorId) } },
      { $limit: 1 },
    ]);
    if (!match.length) return null;
    return this.commentModel.findByIdAndUpdate(commentId, { isHidden: hidden }, { new: true });
  }

  async deleteByAuthor(commentId: string, authorId: string) {
    const match = await this.commentModel.aggregate([
      { $match: { _id: new Types.ObjectId(commentId) } },
      { $lookup: { from: 'stories', localField: 'storyId', foreignField: '_id', as: 'story' } },
      { $unwind: '$story' },
      { $match: { 'story.authorId': new Types.ObjectId(authorId) } },
      { $limit: 1 },
    ]);
    if (!match.length) return null;
    await this.commentModel.findByIdAndDelete(commentId);
    return { success: true };
  }
}


