import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReturnItemDto {
  @ApiProperty()
  @IsUUID()
  saleItemId: string;

  /** Ignored by the server (taken from the original sale item). Kept for older clients. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  quantity: number;

  /** Ignored by the server: the refund is calculated from the original sale. */
  @ApiPropertyOptional({ example: 2800 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  refundAmount?: number;
}

export class CreateReturnDto {
  @ApiProperty()
  @IsUUID()
  saleId: string;

  @ApiProperty({ type: [ReturnItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items: ReturnItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  /** How the refund was paid out. Omitted = cash. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  refundPaymentMethodId?: string;
}
