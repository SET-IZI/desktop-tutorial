import { Body, Controller, Get, Param, Post, Put, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewSettingsDto } from './dto/update-review-settings.dto';
import { ReviewsService } from './reviews.service';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  // Avis publiés d'un barber, filtrés selon les paramètres admin (PRD §8)
  @Get('barber/:barberId')
  forBarber(@Param('barberId') barberId: string) {
    return this.reviews.forBarber(barberId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post()
  create(@Request() req: { user: { userId: string } }, @Body() dto: CreateReviewDto) {
    return this.reviews.create(req.user.userId, dto);
  }

  @Get('settings')
  settings() {
    return this.reviews.getSettings();
  }

  // Réservé à l'admin : afficher/masquer avis, notes et photos
  @UseGuards(AuthGuard('jwt'))
  @Put('settings')
  updateSettings(@Body() dto: UpdateReviewSettingsDto) {
    return this.reviews.updateSettings(dto);
  }
}
