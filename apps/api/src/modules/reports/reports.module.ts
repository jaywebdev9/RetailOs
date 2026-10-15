import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Module({
  controllers: [ReportsController, ExportController],
  providers: [ReportsService, ExportService, PermissionsGuard],
  exports: [ReportsService],
})
export class ReportsModule {}
