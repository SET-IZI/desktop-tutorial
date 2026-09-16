import { Module } from '@nestjs/common';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { PaymentsModule } from '../payments/payments.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [PaymentsModule, LoyaltyModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
