import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BarbersService } from './barbers.service';
import { UpdateDelayStatusDto } from './dto/update-delay-status.dto';

@Controller('barbers')
export class BarbersController {
  constructor(private readonly barbers: BarbersService) {}

  @Get()
  list() {
    return this.barbers.list();
  }

  @Get(':id')
  profile(@Param('id') id: string) {
    return this.barbers.profile(id);
  }

  @Get(':id/stats')
  stats(@Param('id') id: string) {
    return this.barbers.stats(id);
  }

  // PRD §5 — le barber met à jour son statut de retard ;
  // les clients du jour sont notifiés automatiquement.
  @UseGuards(AuthGuard('jwt'))
  @Patch(':id/delay-status')
  updateDelayStatus(@Param('id') id: string, @Body() dto: UpdateDelayStatusDto) {
    return this.barbers.updateDelayStatus(id, dto.status);
  }
}
