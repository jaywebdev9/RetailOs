import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { CreateReturnDto } from './dto/create-return.dto';
import { VoidSaleDto } from './dto/void-sale.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiHeader({ name: 'x-business-id', required: true })
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  private businessId(headers: Record<string, string>) {
    return headers['x-business-id'];
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('sales.create')
  @ApiOperation({ summary: 'Create a sale (POS checkout)' })
  create(
    @Req() req: any,
    @Headers() headers: Record<string, string>,
    @Body() dto: CreateSaleDto,
  ) {
    return this.salesService.create(this.businessId(headers), req.user.sub, dto);
  }

  @Post('returns')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('sales.refund')
  @ApiOperation({ summary: 'Process a sales return' })
  createReturn(
    @Req() req: any,
    @Headers() headers: Record<string, string>,
    @Body() dto: CreateReturnDto,
  ) {
    return this.salesService.createReturn(this.businessId(headers), req.user.sub, dto);
  }

  @Post(':id/void')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('sales.void')
  @ApiOperation({ summary: 'Void a sale (reverses stock, credit and cash)' })
  voidSale(
    @Req() req: any,
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
    @Body() dto: VoidSaleDto,
  ) {
    return this.salesService.voidSale(this.businessId(headers), req.user.sub, id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List sales' })
  findAll(
    @Req() req: any,
    @Headers() headers: Record<string, string>,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.salesService.findAll(this.businessId(headers), req.user.sub, {
      page,
      limit,
      from,
      to,
    });
  }

  @Get('today')
  @ApiOperation({ summary: "Today's sales summary" })
  today(@Req() req: any, @Headers() headers: Record<string, string>) {
    return this.salesService.todaySummary(this.businessId(headers), req.user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get sale by ID' })
  findOne(
    @Req() req: any,
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
  ) {
    return this.salesService.findOne(this.businessId(headers), req.user.sub, id);
  }
}
