import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class AuditLog extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  actorId: Types.ObjectId; // Người thực hiện hành động

  @Prop({ required: true })
  action: string; // Hành động (vd: CREATE, UPDATE, DELETE, LOGIN...)

  @Prop({ required: true })
  target: string; // Đối tượng tác động (vd: "Promotion", "Payment", "User")

  @Prop({ type: Object, required: false })
  details?: Record<string, any> | string; // JSON hoặc string

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
