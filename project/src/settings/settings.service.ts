import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Setting } from './schemas/settings.schema';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(Setting.name) private readonly model: Model<Setting>,
  ) {}

  async create(dto: CreateSettingDto): Promise<Setting> {
    const existing = await this.model.findById('global_settings');
    if (existing) {
      throw new Error('Global settings already exist.');
    }
    const created = new this.model(dto);
    return created.save();
  }

  async findAll(): Promise<Setting[]> {
    return this.model.find().exec();
  }

  async findOne(id = 'global_settings'): Promise<Setting> {
    const setting = await this.model.findById(id).exec();
    if (!setting) throw new NotFoundException('Setting not found');
    return setting;
  }

  async update(id: string, dto: UpdateSettingDto): Promise<Setting> {
    const updated = await this.model
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Setting not found');
    return updated;
  }

  async remove(id: string): Promise<void> {
    const result = await this.model.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('Setting not found');
  }
}
