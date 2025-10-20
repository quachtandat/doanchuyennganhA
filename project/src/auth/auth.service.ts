/* eslint-disable prettier/prettier */

import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './entities/user.entity';
import { RegisterDto, LoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, name, phone, role } = registerDto;

    // Check if user already exists
    const existingUser = await this.userModel.findOne({ email });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Generate salt and hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const newUser = new this.userModel({
      name,
      email,
      phone: phone || '',
      password_hash: hashedPassword,
      salt,
      role: role || 'reader',
      wallet_coins: 0,
      status: 'active',
      author_info: {
        display_name: name, // ✅ FIX: Thêm display_name
        bio: '',
        website: '',
        social_links: {},
      },
    });

    await newUser.save();

    // Generate JWT token
    const payload = {
      email: newUser.email,
      sub: newUser._id,
      role: newUser.role,
    };
    const accessToken = this.jwtService.sign(payload);

    return {
      message: 'User registered successfully',
      accessToken,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
        wallet_coins: newUser.wallet_coins,
        status: newUser.status,
      },
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user by email
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (user.status !== 'active') {
      throw new UnauthorizedException('Account is not active');
    }

    // Generate JWT token
    const payload = { email: user.email, sub: user._id, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    return {
      message: 'Login successful',
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        wallet_coins: user.wallet_coins,
        status: user.status,
      },
    };
  }

  async validateUser(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  async getProfile(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('-password_hash -salt');
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      wallet_coins: user.wallet_coins,
      status: user.status,
      author_info: user.author_info,
      createdAt: user['createdAt'],
      updatedAt: user['updatedAt'],
    };
  }
}
