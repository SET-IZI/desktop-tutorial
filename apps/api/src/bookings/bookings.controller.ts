import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BookingsService } from './bookings.service';
import { AddPhotosDto } from './dto/add-photos.dto';
import { CreateBookingDto } from './dto/create-booking.dto';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  // Créneaux disponibles d'un barber pour une date, avec prix dynamique par créneau.
  // barberId omis = "premier disponible" (agrégation de tous les barbiers).
  @Get('availability')
  availability(
    @Query('date') date: string,
    @Query('serviceId') serviceId: string,
    @Query('barberId') barberId?: string,
  ) {
    return this.bookings.availability(new Date(date), serviceId, barberId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post()
  create(@Request() req: { user: { userId: string } }, @Body() dto: CreateBookingDto) {
    return this.bookings.create(req.user.userId, dto);
  }

  // PRD §6/§7 — historique du client avec photos ("Mes Coupes")
  @UseGuards(AuthGuard('jwt'))
  @Get('history')
  history(@Request() req: { user: { userId: string } }) {
    return this.bookings.history(req.user.userId);
  }

  // PRD §6 — le barber attache 1 à 10 photos à la prestation
  @UseGuards(AuthGuard('jwt'))
  @Post(':id/photos')
  addPhotos(@Param('id') id: string, @Body() dto: AddPhotosDto) {
    return this.bookings.addPhotos(id, dto.photos);
  }
}
