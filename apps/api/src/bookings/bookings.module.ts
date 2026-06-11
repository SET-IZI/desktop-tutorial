import { Module } from '@nestjs/common';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PricingModule } from '../pricing/pricing.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [PricingModule, NotificationsModule, LoyaltyModule],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
