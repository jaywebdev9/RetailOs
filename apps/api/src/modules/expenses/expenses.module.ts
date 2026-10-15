import { Module } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Module({
  controllers: [ExpensesController],
  providers: [ExpensesService, PermissionsGuard],
  exports: [ExpensesService],
})
export class ExpensesModule {}
