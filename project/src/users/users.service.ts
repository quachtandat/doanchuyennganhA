import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  // 🟢 Tạo mới user
  async create(
    dto: CreateUserDto,
  ): Promise<Omit<User, 'password_hash' | 'salt'>> {
    // 🔍 Kiểm tra trùng email hoặc phone
    if (dto.email) {
      const existingEmail = await this.userModel.exists({ email: dto.email });
      if (existingEmail) throw new ConflictException('Email already exists');
    }

    if (dto.phone) {
      const existingPhone = await this.userModel.exists({ phone: dto.phone });
      if (existingPhone) throw new ConflictException('Phone already exists');
    }

    // 🔐 Hash mật khẩu
    const salt = await bcrypt.genSalt(10);
    const password_hash = dto.password
      ? await bcrypt.hash(dto.password, salt)
      : undefined;

    // 🧩 Tạo user mới
    const createdUser = new this.userModel({
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      password_hash,
      salt,
      role: dto.role ?? 'reader',
      wallet_coins: dto.wallet_coins ?? 0,
      author_info: dto.author_info ?? {
        display_name: dto.name ?? '',
        verified: false,
      },
    });

    const user = await createdUser.save();
    const obj = user.toObject();

    // 🚫 TypeScript yêu cầu dùng optional chaining khi delete field có thể undefined
    delete (obj as Partial<User>).password_hash;
    delete (obj as Partial<User>).salt;

    return obj;
  }

  // 🟡 Lấy tất cả user (ẩn password + salt)
  async findAll(skip = 0, limit = 20): Promise<Partial<User>[]> {
    const users = await this.userModel.find().skip(skip).limit(limit).exec();
    return users.map((u) => {
      const obj = u.toObject();
      delete (obj as Partial<User>).password_hash;
      delete (obj as Partial<User>).salt;
      return obj;
    });
  }

  // 🟣 Lấy user theo ID
  async findOne(id: string): Promise<Partial<User>> {
    const user = await this.userModel.findById(id).exec();
    if (!user) throw new NotFoundException('User not found');
    const obj = user.toObject();
    delete (obj as Partial<User>).password_hash;
    delete (obj as Partial<User>).salt;
    return obj;
  }
  // 🟠 Cập nhật user
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User | null> {
    return this.userModel
      .findByIdAndUpdate(id, updateUserDto, { new: true })
      .exec();
  }

  // 🔴 Xóa user
  async remove(id: string): Promise<User | null> {
    return this.userModel.findByIdAndDelete(id).exec();
  }
}
