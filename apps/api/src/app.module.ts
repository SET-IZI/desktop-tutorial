import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { BarbersModule } from './barbers/barbers.module';
import { ServicesModule } from './services/services.module';
import { PricingModule } from './pricing/pricing.module';
import { BookingsModule } from './bookings/bookings.module';
import { ReviewsModule } from './reviews/reviews.module';
import { ProductsModule } from './products/products.module';
import { LoyaltyModule } from './loyalty/loyalty.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    BarbersModule,
    ServicesModule,
    PricingModule,
    BookingsModule,
    ReviewsModule,
    ProductsModule,
    LoyaltyModule,
    NotificationsModule,
    PaymentsModule,
  ],
})
export class AppModule {}
