import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, PermissionsGuard],
  exports: [ProductsService],
})
export class ProductsModule {}
