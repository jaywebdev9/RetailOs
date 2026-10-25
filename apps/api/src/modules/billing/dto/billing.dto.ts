import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PAYMENT_METHODS } from '../billing.constants';

export class SubmitPaymentDto {
  @ApiProperty({ example: 'MONTHLY', description: 'Plan code' })
  @IsString()
  planCode: string;

  @ApiProperty({ enum: PAYMENT_METHODS })
  @IsIn([...PAYMENT_METHODS])
  method: string;

  @ApiProperty({ example: 'QJK3H8D2LM', description: 'Transaction ID from the mobile-money SMS' })
  @IsString()
  @MinLength(4)
  @MaxLength(60)
  reference: string;

  @ApiPropertyOptional({ description: 'Phone the money was sent from' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  payerPhone?: string;
}

export class RejectPaymentDto {
  @ApiProperty({ example: 'Amount received was too small' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  reason: string;
}

export class UpdatePlanDto {
  @ApiPropertyOptional({ example: 15000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(0)
  priceTzs?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateBillingSettingsDto {
  @ApiPropertyOptional({ description: 'Shown to owners: which number to pay and how' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  paymentInstructions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  supportPhone?: string;

  @ApiPropertyOptional({ description: 'true = maintenance mode banner for all shops' })
  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  maintenanceMessage?: string;
}

export class GrantDaysDto {
  @ApiProperty({ example: 14, description: 'Free days to add (support / goodwill)' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(1)
  days: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  planId?: string;
}

export class SetBusinessActiveDto {
  @ApiProperty({ example: false, description: 'false = suspend shop' })
  @IsBoolean()
  isActive: boolean;
}

export class SetPlatformAdminDto {
  @ApiProperty()
  @IsBoolean()
  isPlatformAdmin: boolean;
}
