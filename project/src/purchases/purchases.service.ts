import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Purchase } from './schemas/purchases.schema';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';

@Injectable()
export class PurchasesService {
  constructor(
    @InjectModel(Purchase.name)
    private readonly purchaseModel: Model<Purchase>,
  ) {}

  // 🟢 Tạo purchase
  async create(dto: CreatePurchaseDto): Promise<Purchase> {
    // ✅ Kiểm tra hợp lệ (ví dụ: trùng giao dịch)
    const existing = await this.purchaseModel.findOne({
      userId: dto.userId,
      chapterId: dto.chapterId,
    });
    if (existing) throw new BadRequestException('Chapter already purchased');

    const purchase = new this.purchaseModel({
      ...dto,
      purchaseAt: new Date(),
    });

    return purchase.save();
  }

  // 🟡 Lấy danh sách (populate user + chapter + story)
  async findAll(): Promise<Purchase[]> {
    return this.purchaseModel
      .find()
      .populate('userId', 'name email')
      .populate('chapterId', 'title number')
      .populate('storyId', 'title slug')
      .exec();
  }

  // 🟣 Lấy chi tiết
  async findOne(id: string): Promise<Purchase> {
    const purchase = await this.purchaseModel
      .findById(id)
      .populate('userId', 'name email')
      .populate('chapterId', 'title number')
      .populate('storyId', 'title slug')
      .exec();
    if (!purchase) throw new NotFoundException('Purchase not found');
    return purchase;
  }

  // 🟠 Cập nhật
  async update(id: string, dto: UpdatePurchaseDto): Promise<Purchase> {
    const updated = await this.purchaseModel
      .findByIdAndUpdate(id, dto, { new: true })
      .populate('userId', 'name email')
      .populate('chapterId', 'title number')
      .populate('storyId', 'title slug')
      .exec();

    if (!updated) throw new NotFoundException('Failed to update purchase');
    return updated;
  }

  // 🔴 Xóa
  async remove(id: string): Promise<Purchase> {
    const deleted = await this.purchaseModel.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException('Purchase not found');
    return deleted;
  }
}
