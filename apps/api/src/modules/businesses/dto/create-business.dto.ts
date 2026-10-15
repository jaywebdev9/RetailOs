import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, MinLength, MaxLength } from 'class-validator';

export enum BusinessTypeDto {
  GROCERY = 'GROCERY',
  MINI_SUPERMARKET = 'MINI_SUPERMARKET',
  HARDWARE = 'HARDWARE',
  ELECTRONICS = 'ELECTRONICS',
  CLOTHING = 'CLOTHING',
  PHARMACY = 'PHARMACY',
  WHOLESALE = 'WHOLESALE',
  GENERAL_RETAIL = 'GENERAL_RETAIL',
  OTHER = 'OTHER',
}

export class CreateBusinessDto {
  @ApiProperty({ example: 'Mama Amina Shop' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @ApiProperty({ enum: BusinessTypeDto, example: 'GROCERY' })
  @IsEnum(BusinessTypeDto)
  businessType: BusinessTypeDto;

  @ApiPropertyOptional({ example: 'TZS' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 'Africa/Dar_es_Salaam' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;
}
