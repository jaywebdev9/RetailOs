import { Controller, Get, Query, UseGuards, Req, Headers } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiHeader({ name: 'x-business-id', required: true })
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  private businessId(h: Record<string, string>) {
    return h['x-business-id'];
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Dashboard metrics from real data' })
  dashboard(@Req() req: any, @Headers() h: Record<string, string>) {
    return this.reportsService.dashboard(this.businessId(h), req.user.sub);
  }

  @Get('profit')
  @ApiOperation({ summary: 'Profit summary for a date range' })
  profit(
    @Req() req: any,
    @Headers() h: Record<string, string>,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.reportsService.profitSummary(
      this.businessId(h),
      req.user.sub,
      from,
      to,
    );
  }
}
