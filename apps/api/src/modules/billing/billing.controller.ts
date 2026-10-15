import { Body, Controller, Get, Headers, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BillingService } from './billing.service';
import { SubmitPaymentDto } from './dto/billing.dto';
import { SkipSubscription } from './skip-subscription.decorator';

/** Billing must work even when the plan has expired (that is when people need it most). */
@ApiTags('Billing')
@ApiBearerAuth()
@SkipSubscription()
@UseGuards(JwtAuthGuard)
@ApiHeader({ name: 'x-business-id', required: true })
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('plans')
  @ApiOperation({ summary: 'Plans, prices and how to pay' })
  plans() {
    return this.billing.listPlans();
  }

  @Get('status')
  @ApiOperation({ summary: 'Trial / plan status of this business' })
  status(@Req() req: any, @Headers('x-business-id') businessId: string) {
    return this.billing.status(businessId, req.user.sub);
  }

  @Get('payments')
  @ApiOperation({ summary: 'Subscription payment history' })
  payments(@Req() req: any, @Headers('x-business-id') businessId: string) {
    return this.billing.payments(businessId, req.user.sub);
  }

  @Post('payments')
  @ApiOperation({ summary: 'Owner submits a mobile-money payment reference for confirmation' })
  submit(@Req() req: any, @Headers('x-business-id') businessId: string, @Body() dto: SubmitPaymentDto) {
    return this.billing.submitPayment(businessId, req.user.sub, dto);
  }
}
