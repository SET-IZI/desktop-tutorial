import { ArrayNotEmpty, IsArray, IsDateString, IsString } from 'class-validator';

export class CreateBookingDto {
  @IsString()
  barberId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  serviceIds!: string[];

  @IsDateString()
  startsAt!: string;
}
