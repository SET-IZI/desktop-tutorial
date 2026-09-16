import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { LoyaltyService } from './loyalty.service';

@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly loyalty: LoyaltyService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('balance')
  balance(@Request() req: { user: { userId: string } }) {
    return this.loyalty.balance(req.user.userId);
  }
}
