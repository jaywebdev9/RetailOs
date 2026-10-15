import {
  Controller, Get, Post, Body, Param, UseGuards, Req, Headers,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto, ReceivePurchaseDto } from './dto/create-purchase.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Purchases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiHeader({ name: 'x-business-id', required: true })
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  private businessId(h: Record<string, string>) {
    return h['x-business-id'];
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('purchases.create')
  @ApiOperation({ summary: 'Create purchase order' })
  create(@Req() req: any, @Headers() h: Record<string, string>, @Body() dto: CreatePurchaseDto) {
    return this.purchasesService.create(this.businessId(h), req.user.sub, dto);
  }

  @Post(':id/receive')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('purchases.receive')
  @ApiOperation({ summary: 'Receive stock against a purchase (partial or full)' })
  receive(
    @Req() req: any,
    @Headers() h: Record<string, string>,
    @Param('id') id: string,
    @Body() dto: ReceivePurchaseDto,
  ) {
    return this.purchasesService.receive(this.businessId(h), req.user.sub, id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List purchases' })
  findAll(@Req() req: any, @Headers() h: Record<string, string>) {
    return this.purchasesService.findAll(this.businessId(h), req.user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get purchase details' })
  findOne(@Req() req: any, @Headers() h: Record<string, string>, @Param('id') id: string) {
    return this.purchasesService.findOne(this.businessId(h), req.user.sub, id);
  }
}
