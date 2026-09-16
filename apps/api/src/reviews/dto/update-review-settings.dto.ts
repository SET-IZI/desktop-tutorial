import { IsBoolean } from 'class-validator';

export class UpdateReviewSettingsDto {
  @IsBoolean()
  showReviews!: boolean;

  @IsBoolean()
  showRating!: boolean;

  @IsBoolean()
  showPhotos!: boolean;
}
