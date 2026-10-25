import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from './platform-admin.guard';
import { AdminBillingService } from './admin-billing.service';
import {
  GrantDaysDto,
  RejectPaymentDto,
  SetBusinessActiveDto,
  SetPlatformAdminDto,
  UpdateBillingSettingsDto,
  UpdatePlanDto,
} from './dto/billing.dto';
import { SkipSubscription } from './skip-subscription.decorator';
import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class SetActiveDto {
  @ApiProperty()
  @IsBoolean()
  isActive: boolean;
}

@ApiTags('Admin billing')
@ApiBearerAuth()
@SkipSubscription()
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@Controller('admin/billing')
export class AdminBillingController {
  constructor(private readonly admin: AdminBillingService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Platform KPIs' })
  summary() {
    return this.admin.summary();
  }

  @Get('payments')
  @ApiOperation({ summary: 'Subscription payments (?status=PENDING|CONFIRMED|REJECTED)' })
  payments(@Query('status') status?: string) {
    return this.admin.payments(status);
  }

  @Post('payments/:id/confirm')
  confirm(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.confirmPayment(id, req.user.sub);
  }

  @Post('payments/:id/reject')
  reject(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectPaymentDto) {
    return this.admin.rejectPayment(id, req.user.sub, dto.reason);
  }

  @Get('businesses')
  businesses() {
    return this.admin.businesses();
  }

  @Get('businesses/:id')
  businessDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.businessDetail(id);
  }

  @Post('businesses/:id/grant-days')
  grant(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: GrantDaysDto) {
    return this.admin.grantDays(id, req.user.sub, dto.days);
  }

  @Post('businesses/:id/set-active')
  setActive(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetBusinessActiveDto,
  ) {
    return this.admin.setBusinessActive(id, req.user.sub, dto.isActive);
  }

  @Post('businesses/:id/force-expire')
  forceExpire(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.forceExpire(id, req.user.sub);
  }

  @Get('plans')
  plans() {
    return this.admin.plans();
  }

  @Patch('plans/:id')
  updatePlan(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePlanDto) {
    return this.admin.updatePlan(id, dto);
  }

  @Get('settings')
  settings() {
    return this.admin.settings();
  }

  @Put('settings')
  updateSettings(@Body() dto: UpdateBillingSettingsDto) {
    return this.admin.updateSettings(dto);
  }

  @Get('audit')
  audit(@Query('limit') limit?: string) {
    return this.admin.auditLogs(limit ? Number(limit) : 100);
  }

  @Get('admins')
  listAdmins() {
    return this.admin.listPlatformAdmins();
  }

  @Get('users/search')
  searchUsers(@Query('q') q?: string) {
    return this.admin.searchUsers(q || '');
  }

  @Post('users/:id/platform-admin')
  setPlatformAdmin(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetPlatformAdminDto,
  ) {
    return this.admin.setPlatformAdmin(id, req.user.sub, dto.isPlatformAdmin);
  }

  @Post('users/:id/set-active')
  setUserActive(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SetActiveDto) {
    return this.admin.setUserActive(id, req.user.sub, dto.isActive);
  }
}
