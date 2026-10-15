import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Module({
  controllers: [InventoryController],
  providers: [InventoryService, PermissionsGuard],
  exports: [InventoryService],
})
export class InventoryModule {}
