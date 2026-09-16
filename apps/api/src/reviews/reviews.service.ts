import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewSettingsDto } from './dto/update-review-settings.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async forBarber(barberId: string) {
    const settings = await this.getSettings();
    if (!settings.showReviews) return { reviews: [], settings };

    const reviews = await this.prisma.review.findMany({
      where: { barberId, published: true },
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { firstName: true } } },
    });
    return {
      settings,
      reviews: reviews.map((r) => ({
        id: r.id,
        author: r.author.firstName,
        comment: r.comment,
        rating: settings.showRating ? r.rating : undefined,
        photoUrls: settings.showPhotos ? r.photoUrls : [],
        createdAt: r.createdAt,
      })),
    };
  }

  async create(authorId: string, dto: CreateReviewDto) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: dto.appointmentId },
    });
    if (!appointment || appointment.clientId !== authorId || appointment.status !== 'COMPLETED') {
      throw new BadRequestException('Seules les prestations terminées peuvent être notées');
    }
    return this.prisma.review.create({
      data: {
        appointmentId: dto.appointmentId,
        authorId,
        barberId: appointment.barberId,
        rating: dto.rating,
        comment: dto.comment,
        photoUrls: dto.photoUrls ?? [],
      },
    });
  }

  async getSettings() {
    return (
      (await this.prisma.reviewSettings.findUnique({ where: { id: 1 } })) ?? {
        id: 1,
        showReviews: true,
        showRating: true,
        showPhotos: true,
      }
    );
  }

  updateSettings(dto: UpdateReviewSettingsDto) {
    return this.prisma.reviewSettings.upsert({
      where: { id: 1 },
      update: dto,
      create: { id: 1, ...dto },
    });
  }
}
