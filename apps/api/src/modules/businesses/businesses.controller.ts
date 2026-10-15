import { Controller, Post, Get, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BusinessesService } from './businesses.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Businesses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new business (onboarding)' })
  async create(@Req() req: any, @Body() dto: CreateBusinessDto) {
    return this.businessesService.create(req.user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List my businesses' })
  async list(@Req() req: any) {
    return this.businessesService.listForUser(req.user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get business details' })
  async findOne(@Req() req: any, @Param('id') id: string) {
    return this.businessesService.findOne(id, req.user.sub);
  }
}
