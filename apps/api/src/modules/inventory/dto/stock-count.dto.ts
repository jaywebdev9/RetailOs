import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class StockCountItemInputDto {
  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 96 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  physicalQuantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CompleteStockCountDto {
  @ApiProperty({ type: [StockCountItemInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockCountItemInputDto)
  items: StockCountItemInputDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
