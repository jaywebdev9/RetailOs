import { Controller, Get, Query, UseGuards, Req, Headers, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ExportService } from './export.service';

@ApiTags('Exports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('reports.view')
@ApiHeader({ name: 'x-business-id', required: true })
@Controller('reports/export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  private send(res: Response, filename: string, csv: string) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return csv;
  }

  @Get('sales')
  @ApiOperation({ summary: 'Sales lines as CSV (Excel)' })
  async sales(
    @Req() req: any,
    @Headers() h: Record<string, string>,
    @Res({ passthrough: true }) res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const csv = await this.exportService.sales(h['x-business-id'], from, to);
    return this.send(res, 'sales.csv', csv);
  }

  @Get('stock')
  @ApiOperation({ summary: 'Current stock and stock value as CSV' })
  async stock(
    @Req() req: any,
    @Headers() h: Record<string, string>,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(res, 'stock.csv', await this.exportService.stock(h['x-business-id']));
  }

  @Get('customer-debts')
  @ApiOperation({ summary: 'Who owes what (with overdue ageing) as CSV' })
  async customerDebts(
    @Req() req: any,
    @Headers() h: Record<string, string>,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(
      res,
      'customer-debts.csv',
      await this.exportService.customerDebts(h['x-business-id']),
    );
  }
}
