import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from './platform-admin.guard';
import { AdminBillingService } from './admin-billing.service';
import { GrantDaysDto, RejectPaymentDto, UpdateBillingSettingsDto, UpdatePlanDto } from './dto/billing.dto';
import { SkipSubscription } from './skip-subscription.decorator';

@ApiTags('Admin billing')
@ApiBearerAuth()
@SkipSubscription()
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@Controller('admin/billing')
export class AdminBillingController {
  constructor(private readonly admin: AdminBillingService) {}

  @Get('payments')
  @ApiOperation({ summary: 'Subscription payments (?status=PENDING|CONFIRMED|REJECTED)' })
  payments(@Query('status') status?: string) {
    return this.admin.payments(status);
  }

  @Post('payments/:id/confirm')
  @ApiOperation({ summary: 'Confirm a payment and extend the subscription' })
  confirm(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.confirmPayment(id, req.user.sub);
  }

  @Post('payments/:id/reject')
  @ApiOperation({ summary: 'Reject a payment' })
  reject(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectPaymentDto) {
    return this.admin.rejectPayment(id, req.user.sub, dto.reason);
  }

  @Get('businesses')
  @ApiOperation({ summary: 'All businesses with plan state and expiry date' })
  businesses() {
    return this.admin.businesses();
  }

  @Post('businesses/:id/grant-days')
  @ApiOperation({ summary: 'Give a business free days' })
  grant(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: GrantDaysDto) {
    return this.admin.grantDays(id, req.user.sub, dto.days);
  }

  @Get('plans')
  @ApiOperation({ summary: 'All plans including inactive' })
  plans() {
    return this.admin.plans();
  }

  @Patch('plans/:id')
  @ApiOperation({ summary: 'Change a plan price or switch it off' })
  updatePlan(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePlanDto) {
    return this.admin.updatePlan(id, dto);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Payment instructions shown to owners' })
  settings() {
    return this.admin.settings();
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update payment instructions and support phone' })
  updateSettings(@Body() dto: UpdateBillingSettingsDto) {
    return this.admin.updateSettings(dto);
  }
}
