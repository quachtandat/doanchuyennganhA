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

    // ✅ FIX: Ensure display_name is always provided
    const displayName = dto.author_info?.display_name || dto.name || 'User';

    // 🧩 Tạo user mới
    const createdUser = new this.userModel({
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      password_hash,
      salt,
      role: dto.role ?? 'reader',
      wallet_coins: dto.wallet_coins ?? 0,
      author_info: {
        display_name: displayName,
        verified: dto.author_info?.verified ?? false,
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
  async findAll(skip = 0, limit = 20, q?: string, role?: string): Promise<Partial<User>[]> {
    const filter: any = {};
    if (role) filter.role = role;
    if (q && q.trim()) filter.name = { $regex: q.trim(), $options: 'i' };
    const users = await this.userModel.find(filter).skip(skip).limit(limit).exec();
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
  async update(id: string, payload: any): Promise<User | null> {
    // Only copy explicitly provided fields from payload to avoid DTO defaults overwriting existing values
    const allowed = [
      'name',
      'email',
      'phone',
      'password',
      'role',
      'wallet_coins',
      'status',
      'author_info',
    ];

    const update: any = {};
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        update[key] = payload[key];
      }
    }

    // Ensure if updating author_info but no display_name provided, keep existing display_name
    if (update.author_info && !update.author_info.display_name) {
      const user = await this.userModel.findById(id).exec();
      if (user) {
        update.author_info.display_name = user.name || 'User';
      }
    }

    // If client provided a plain `password`, hash it and store as password_hash + salt
    if (Object.prototype.hasOwnProperty.call(update, 'password')) {
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(update.password, salt);
      update.password_hash = password_hash;
      update.salt = salt;
      // remove plain password before saving
      delete update.password;
    }

    if (Object.keys(update).length === 0) {
      // nothing to update
      return this.findOne(id) as any;
    }

    const updated = await this.userModel
      .findByIdAndUpdate(id, update, { new: true })
      .exec();

    if (!updated) return null;

    const obj = updated.toObject();
    // remove sensitive fields before returning
    delete (obj as Partial<User>).password_hash;
    delete (obj as Partial<User>).salt;

    return obj as any;
  }

  // 🔴 Xóa user
  async remove(id: string): Promise<User | null> {
    return this.userModel.findByIdAndDelete(id).exec();
  }
}
