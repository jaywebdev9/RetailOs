import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req, Headers,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, CustomerPaymentDto, UpdateCustomerDto } from './dto/create-customer.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiHeader({ name: 'x-business-id', required: true })
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  private businessId(h: Record<string, string>) {
    return h['x-business-id'];
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('customers.create')
  @ApiOperation({ summary: 'Create customer' })
  create(@Req() req: any, @Headers() h: Record<string, string>, @Body() dto: CreateCustomerDto) {
    return this.customersService.create(this.businessId(h), req.user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List customers with balances' })
  findAll(@Req() req: any, @Headers() h: Record<string, string>) {
    return this.customersService.findAll(this.businessId(h), req.user.sub);
  }

  @Get('overdue')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('customers.credit')
  @ApiOperation({ summary: 'Customers with overdue debt, with ageing buckets' })
  overdue(@Req() req: any, @Headers() h: Record<string, string>) {
    return this.customersService.overdue(this.businessId(h), req.user.sub);
  }

  @Get(':id/statement')
  @ApiOperation({ summary: 'Customer account statement with running balance' })
  statement(
    @Req() req: any,
    @Headers() h: Record<string, string>,
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.customersService.statement(this.businessId(h), req.user.sub, id, { from, to });
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('customers.create')
  @ApiOperation({ summary: 'Update customer (type, credit limit, payment terms...)' })
  update(
    @Req() req: any,
    @Headers() h: Record<string, string>,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(this.businessId(h), req.user.sub, id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get customer with ledger' })
  findOne(@Req() req: any, @Headers() h: Record<string, string>, @Param('id') id: string) {
    return this.customersService.findOne(this.businessId(h), req.user.sub, id);
  }

  @Post(':id/payments')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('customers.payment')
  @ApiOperation({ summary: 'Record customer payment (reduces credit balance)' })
  pay(
    @Req() req: any,
    @Headers() h: Record<string, string>,
    @Param('id') id: string,
    @Body() dto: CustomerPaymentDto,
  ) {
    return this.customersService.recordPayment(this.businessId(h), req.user.sub, id, dto);
  }
}
