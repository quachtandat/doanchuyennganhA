import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditLog } from './schemas/audit-log.schema';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { UpdateAuditLogDto } from './dto/update-audit-log.dto';

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLog>,
  ) {}

  async create(dto: CreateAuditLogDto): Promise<AuditLog> {
    const created = new this.auditLogModel({
      ...dto,
      actorId: new Types.ObjectId(dto.actorId),
    });
    return created.save();
  }

  async findAll(): Promise<AuditLog[]> {
    return this.auditLogModel
      .find()
      .populate('actorId', 'username email')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string): Promise<AuditLog> {
    const log = await this.auditLogModel
      .findById(id)
      .populate('actorId', 'username email')
      .exec();
    if (!log) throw new NotFoundException('Audit log not found');
    return log;
  }

  async findByActor(actorId: string): Promise<AuditLog[]> {
    return this.auditLogModel
      .find({ actorId: new Types.ObjectId(actorId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async update(id: string, dto: UpdateAuditLogDto): Promise<AuditLog> {
    const updated = await this.auditLogModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Audit log not found');
    return updated;
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.auditLogModel.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException('Audit log not found');
  }
}
