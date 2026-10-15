import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductPackDto {
  @ApiProperty({ example: 'Carton' })
  @IsString()
  @MaxLength(50)
  name: string;

  @ApiProperty({ example: 24, description: 'How many base units are in one pack' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  factor: number;

  @ApiPropertyOptional({ description: 'Retail price per pack (empty = base price × factor)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  retailPrice?: number;

  @ApiPropertyOptional({ description: 'Wholesale price per pack (empty = wholesale price × factor)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  wholesalePrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  barcode?: string;
}
