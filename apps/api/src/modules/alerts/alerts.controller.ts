import { Controller, Get, UseGuards, Req, Headers } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { AlertsService } from './alerts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiHeader({ name: 'x-business-id', required: true })
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  @ApiOperation({ summary: 'Open alerts: low stock, stock-out risk, overdue credit' })
  list(@Req() req: any, @Headers() h: Record<string, string>) {
    return this.alerts.refresh(h['x-business-id'], req.user.sub);
  }
}
