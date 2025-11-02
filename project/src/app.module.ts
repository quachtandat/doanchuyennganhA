import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ViewController } from '../views/view.controller';

// Users
import { UsersModule } from './users/users.module';
import { User, UserSchema } from './users/schemas/user.schema';

// Stories
import { StoriesModule } from './stories/stories.module';
import { Story, StorySchema } from './stories/schemas/stories.schema';

// Chapters
import { ChaptersModule } from './chapters/chapters.module';
import { Chapter, ChapterSchema } from './chapters/schemas/chapters.schema';

// Purchases
import { PurchasesModule } from './purchases/purchases.module';
import { Purchase, PurchaseSchema } from './purchases/schemas/purchases.schema';

// Reading histories
import { ReadingHistoriesModule } from './reading_histories/reading_histories.module';
import {
  ReadingHistory,
  ReadingHistorySchema,
} from './reading_histories/schemas/reading_histories.schema';

// Reports
import { ReportsModule } from './reports/reports.module';
import { Report, ReportSchema } from './reports/schemas/reports.schema';

// Payments
import { PaymentsModule } from './payments/payments.module';
import { Payment, PaymentSchema } from './payments/schemas/payments.schema';

// Wallet transactions
import { WalletTransactionsModule } from './wallet-transactions/wallet_transactions.module';
import {
  WalletTransaction,
  WalletTransactionSchema,
} from './wallet-transactions/schemas/wallet_transactions.schema';

// Settings
import { SettingsModule } from './settings/settings.module';
import { Setting, SettingSchema } from './settings/schemas/settings.schema';

// Promotions
import { PromotionsModule } from './promotions/promotions.module';
import {
  Promotion,
  PromotionSchema,
} from './promotions/schemas/promotions.schema';

// Audit logs
import { AuditLogsModule } from './audit_logs/audit_logs.module';
import {
  AuditLog,
  AuditLogSchema,
} from './audit_logs/schemas/audit-log.schema';

// Auth Module
import { AuthModule } from './auth/auth.module';

// Wallet Module
import { WalletModule } from './wallet/wallet.module';

// View Module
import { ViewModule } from '../views/view.module';

// App Controller & Service
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(process.env.MONGO_URI!),
    // Register all schemas
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Story.name, schema: StorySchema },
      { name: Chapter.name, schema: ChapterSchema },
      { name: Purchase.name, schema: PurchaseSchema },
      { name: ReadingHistory.name, schema: ReadingHistorySchema },
      { name: Report.name, schema: ReportSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: WalletTransaction.name, schema: WalletTransactionSchema },
      { name: Setting.name, schema: SettingSchema },
      { name: Promotion.name, schema: PromotionSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
    // Modules
    UsersModule,
    StoriesModule,
    ChaptersModule,
    PurchasesModule,
    ReadingHistoriesModule,
    ReportsModule,
    PaymentsModule,
    WalletTransactionsModule,
    SettingsModule,
    PromotionsModule,
    AuditLogsModule,
    AuthModule,
    WalletModule,
    ViewModule,
  ],
  controllers: [ViewController],
})
export class AppModule {}