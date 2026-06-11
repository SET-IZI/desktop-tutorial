import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { BarbersController } from './barbers.controller';
import { BarbersService } from './barbers.service';

@Module({
  imports: [NotificationsModule],
  controllers: [BarbersController],
  providers: [BarbersService],
  exports: [BarbersService],
})
export class BarbersModule {}
