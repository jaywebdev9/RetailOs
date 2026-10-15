import { Module } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { SuppliersController } from './suppliers.controller';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Module({
  controllers: [SuppliersController],
  providers: [SuppliersService, PermissionsGuard],
  exports: [SuppliersService],
})
export class SuppliersModule {}
