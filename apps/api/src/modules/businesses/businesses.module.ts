import { Module } from '@nestjs/common';
import { BusinessesService } from './businesses.service';
import { BusinessesController } from './businesses.controller';
import { PaymentMethodsController } from './payment-methods.controller';

@Module({
  controllers: [BusinessesController, PaymentMethodsController],
  providers: [BusinessesService],
  exports: [BusinessesService],
})
export class BusinessesModule {}
