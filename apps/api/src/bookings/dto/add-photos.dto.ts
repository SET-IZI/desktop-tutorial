import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, IsUrl, ValidateNested } from 'class-validator';

class PhotoDto {
  @IsUrl()
  url!: string;

  // Face, Profil gauche, Profil droit, Arrière…
  @IsOptional()
  @IsString()
  label?: string;
}

export class AddPhotosDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PhotoDto)
  photos!: PhotoDto[];
}
