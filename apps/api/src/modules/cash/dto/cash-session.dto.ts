import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class OpenCashSessionDto {
  @ApiProperty({ example: 100000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  openingCash: number;
}

export class CloseCashSessionDto {
  @ApiProperty({ example: 492000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  actualCash: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  differenceReason?: string;
}

export class CashMovementDto {
  @ApiProperty({ enum: ['CASH_IN', 'CASH_OUT', 'OWNER_WITHDRAWAL'] })
  @IsIn(['CASH_IN', 'CASH_OUT', 'OWNER_WITHDRAWAL'])
  type: 'CASH_IN' | 'CASH_OUT' | 'OWNER_WITHDRAWAL';

  @ApiProperty({ example: 20000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
