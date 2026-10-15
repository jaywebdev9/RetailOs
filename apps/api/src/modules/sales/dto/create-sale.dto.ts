import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SaleItemDto {
  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  quantity: number;

  /** Sell by pack (carton, sack...). Then quantity and sellingPrice are per pack. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  packId?: string;

  /** Price per unit (or per pack when packId is set). Omit to let the server pick retail/wholesale price. */
  @ApiPropertyOptional({ example: 2800 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  sellingPrice?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  discount?: number;
}

export class SalePaymentDto {
  @ApiProperty()
  @IsUUID()
  paymentMethodId: string;

  @ApiProperty({ example: 5600 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;
}

export class CreateSaleDto {
  @ApiProperty({ type: [SaleItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];

  @ApiProperty({ type: [SalePaymentDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SalePaymentDto)
  payments: SalePaymentDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  discount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  /** When an OFFLINE sale was made on the device. Lets it sync after the plan expired (up to 7 days). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  offlineCreatedAt?: string;

  /** When the unpaid part must be paid (ISO date). Default: customer's payment terms. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  /** Client-generated UUID for offline idempotency */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientTransactionId?: string;
}
