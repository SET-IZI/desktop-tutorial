import { DelayStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateDelayStatusDto {
  @IsEnum(DelayStatus)
  status!: DelayStatus;
}
