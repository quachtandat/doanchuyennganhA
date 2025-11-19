import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payment } from './schemas/payments.schema';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(@InjectModel(Payment.name) private model: Model<Payment>) {}

  create(dto: CreatePaymentDto) {
    const payment = new this.model(dto);
    return payment.save();
  }

  findAll() {
    return this.model.find().populate('userId', 'name email');
  }

  async findOne(id: string) {
    const doc = await this.model.findById(id).populate('userId', 'name email');
    if (!doc) throw new NotFoundException('Payment not found');
    return doc;
  }

  async update(id: string, dto: UpdatePaymentDto) {
    const updated = await this.model.findByIdAndUpdate(id, dto, { new: true });
    if (!updated) throw new NotFoundException('Payment not found');
    return updated;
  }

  async remove(id: string) {
    const deleted = await this.model.findByIdAndDelete(id);
    if (!deleted) throw new NotFoundException('Payment not found');
  }
}
