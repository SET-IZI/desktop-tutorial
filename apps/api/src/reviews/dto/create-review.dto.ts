import { IsArray, IsInt, IsOptional, IsString, IsUrl, Max, Min } from 'class-validator';

export class CreateReviewDto {
  @IsString()
  appointmentId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  photoUrls?: string[];
}
