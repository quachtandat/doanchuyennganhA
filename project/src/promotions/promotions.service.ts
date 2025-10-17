import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Promotion } from './schemas/promotions.schema';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';

@Injectable()
export class PromotionsService {
  constructor(
    @InjectModel(Promotion.name)
    private readonly promotionModel: Model<Promotion>,
  ) {}

  async create(dto: CreatePromotionDto): Promise<Promotion> {
    const promo = new this.promotionModel(dto);
    return promo.save();
  }

  async findAll(): Promise<Promotion[]> {
    return this.promotionModel.find().sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string): Promise<Promotion> {
    const promo = await this.promotionModel.findById(id).exec();
    if (!promo) throw new NotFoundException('Promotion not found');
    return promo;
  }

  async findByCode(code: string): Promise<Promotion | null> {
    return this.promotionModel.findOne({ code }).exec();
  }

  async update(id: string, dto: UpdatePromotionDto): Promise<Promotion> {
    const updated = await this.promotionModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Promotion not found');
    return updated;
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.promotionModel.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException('Promotion not found');
  }
}
