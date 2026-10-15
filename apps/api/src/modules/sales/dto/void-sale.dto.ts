import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class VoidSaleDto {
  @ApiProperty({ example: 'Cashier entered the wrong item' })
  @IsString()
  @MinLength(3)
  reason: string;
}
