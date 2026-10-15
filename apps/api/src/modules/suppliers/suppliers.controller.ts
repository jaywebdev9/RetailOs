import { Controller, Get, Post, Body, Param, UseGuards, Req, Headers } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { SupplierPaymentDto } from './dto/supplier-payment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Suppliers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiHeader({ name: 'x-business-id', required: true })
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  private businessId(h: Record<string, string>) {
    return h['x-business-id'];
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('suppliers.create')
  @ApiOperation({ summary: 'Create supplier' })
  create(@Req() req: any, @Headers() h: Record<string, string>, @Body() dto: CreateSupplierDto) {
    return this.suppliersService.create(this.businessId(h), req.user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List suppliers' })
  findAll(@Req() req: any, @Headers() h: Record<string, string>) {
    return this.suppliersService.findAll(this.businessId(h), req.user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get supplier with balance' })
  findOne(@Req() req: any, @Headers() h: Record<string, string>, @Param('id') id: string) {
    return this.suppliersService.findOne(this.businessId(h), req.user.sub, id);
  }

  @Post(':id/payments')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('suppliers.payment')
  @ApiOperation({ summary: 'Record supplier payment (reduces outstanding balance)' })
  pay(
    @Req() req: any,
    @Headers() h: Record<string, string>,
    @Param('id') id: string,
    @Body() dto: SupplierPaymentDto,
  ) {
    return this.suppliersService.recordPayment(this.businessId(h), req.user.sub, id, dto);
  }
}
