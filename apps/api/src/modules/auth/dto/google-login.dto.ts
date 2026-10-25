import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class GoogleLoginDto {
  @ApiProperty({ description: 'Google ID token from GIS' })
  @IsString()
  @MinLength(20)
  idToken: string;
}
