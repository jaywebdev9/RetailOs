import { Module } from '@nestjs/common';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { ReceiptController } from './receipt.controller';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Module({
  controllers: [SalesController, ReceiptController],
  providers: [SalesService, PermissionsGuard],
  exports: [SalesService],
})
export class SalesModule {}
