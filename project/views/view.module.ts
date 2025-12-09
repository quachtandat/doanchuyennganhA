import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ViewController } from './view.controller';
import { ViewService } from './view.service';
import { Story, StorySchema } from '../src/stories/schemas/stories.schema';
import {
  Chapter,
  ChapterSchema,
} from '../src/chapters/schemas/chapters.schema';
import { User, UserSchema } from '../src/users/schemas/user.schema';
import {
  ReadingHistory,
  ReadingHistorySchema,
} from '../src/reading_histories/schemas/reading_histories.schema';
import { Purchase, PurchaseSchema } from '../src/purchases/schemas/purchases.schema';
import { Payment, PaymentSchema } from '../src/payments/schemas/payment.schema';
import { Report, ReportSchema } from '../src/reports/schemas/reports.schema';
import { AuthorRequest, AuthorRequestSchema } from '../src/author_requests/schemas/author_request.schema';
import { AuthModule } from '../src/auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Story.name, schema: StorySchema },
      { name: Chapter.name, schema: ChapterSchema },
      { name: User.name, schema: UserSchema },
      { name: ReadingHistory.name, schema: ReadingHistorySchema },
        { name: Purchase.name, schema: PurchaseSchema },
        { name: Payment.name, schema: PaymentSchema },
      { name: Report.name, schema: ReportSchema },
      { name: AuthorRequest.name, schema: AuthorRequestSchema },
    ]),
    AuthModule,
  ],
  controllers: [ViewController],
  providers: [ViewService],
})
export class ViewModule {}
