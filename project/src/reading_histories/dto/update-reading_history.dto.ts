import { PartialType } from '@nestjs/mapped-types';
import { CreateReadingHistoryDto } from './create-reading_history.dto';

export class UpdateReadingHistoryDto extends PartialType(
  CreateReadingHistoryDto,
) {}
