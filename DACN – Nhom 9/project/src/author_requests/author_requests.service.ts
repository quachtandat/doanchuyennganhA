import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuthorRequest, AuthorRequestDocument } from './schemas/author_request.schema';
import { CreateAuthorRequestDto } from './dto/create-author-request.dto';
import { UpdateAuthorRequestDto } from './dto/update-author-request.dto';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class AuthorRequestsService {
  constructor(
    @InjectModel(AuthorRequest.name)
    private readonly authorRequestModel: Model<AuthorRequestDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async create(userId: string, dto: CreateAuthorRequestDto): Promise<AuthorRequest> {
    const userObjectId = new Types.ObjectId(userId);

    const existing = await this.authorRequestModel.findOne({ userId: userObjectId, status: 'pending' });
    if (existing) throw new BadRequestException('Đã có yêu cầu đang chờ duyệt');

    const request = new this.authorRequestModel({
      userId: userObjectId,
      message: dto.message ?? '',
    });
    return request.save();
  }

  async findMy(userId: string): Promise<AuthorRequest[]> {
    return this.authorRequestModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findAll(): Promise<AuthorRequest[]> {
    return this.authorRequestModel
      .find()
      .populate('userId', 'name email role')
      .sort({ createdAt: -1 })
      .exec();
  }

  async updateStatus(id: string, dto: UpdateAuthorRequestDto): Promise<AuthorRequest> {
    const req = await this.authorRequestModel.findById(id);
    if (!req) throw new BadRequestException('Yêu cầu không tồn tại');
    if (req.status !== 'pending') throw new BadRequestException('Yêu cầu đã được xử lý');

    req.status = dto.status;
    req.adminNote = dto.adminNote ?? req.adminNote;
    await req.save();

    if (dto.status === 'approved') {
      await this.userModel.findByIdAndUpdate(req.userId, { role: 'author' });
    }

    return req;
  }
}


