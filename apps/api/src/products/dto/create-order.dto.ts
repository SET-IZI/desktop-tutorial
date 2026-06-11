import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsInt, IsString, Min, ValidateNested } from 'class-validator';

class OrderItemDto {
  @IsString()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateOrderDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}
