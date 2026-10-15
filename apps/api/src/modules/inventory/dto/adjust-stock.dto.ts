import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsNumber, IsString, IsOptional, IsEnum, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum AdjustReason {
  DAMAGE = 'DAMAGE',
  EXPIRED = 'EXPIRED',
  LOSS = 'LOSS',
  MANUAL_ADJUSTMENT = 'MANUAL_ADJUSTMENT',
  COUNTING_ERROR = 'COUNTING_ERROR',
  OTHER = 'OTHER',
}

export class AdjustStockDto {
  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiProperty({ description: 'Signed quantity: positive = increase, negative = decrease' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  quantity: number;

  @ApiProperty({ enum: AdjustReason })
  @IsEnum(AdjustReason)
  reason: AdjustReason;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
