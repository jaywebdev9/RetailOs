import { Module } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { PurchasesController } from './purchases.controller';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Module({
  controllers: [PurchasesController],
  providers: [PurchasesService, PermissionsGuard],
  exports: [PurchasesService],
})
export class PurchasesModule {}
