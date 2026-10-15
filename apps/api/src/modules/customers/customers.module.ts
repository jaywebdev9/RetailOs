import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Module({
  controllers: [CustomersController],
  providers: [CustomersService, PermissionsGuard],
  exports: [CustomersService],
})
export class CustomersModule {}
