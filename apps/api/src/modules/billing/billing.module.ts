import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { BillingController } from './billing.controller';
import { AdminBillingController } from './admin-billing.controller';
import { BillingService } from './billing.service';
import { AdminBillingService } from './admin-billing.service';
import { SubscriptionStateService } from './subscription-state.service';
import { SubscriptionGuard } from './subscription.guard';
import { PlatformAdminGuard } from './platform-admin.guard';
import { BillingJobs } from './billing.jobs';
import { BILLING_NOTIFIER, LogBillingNotifier } from './notifier';
import { ManualPaymentProvider, PAYMENT_PROVIDER } from './payment-provider';

@Module({
  controllers: [BillingController, AdminBillingController],
  providers: [
    BillingService,
    AdminBillingService,
    SubscriptionStateService,
    PlatformAdminGuard,
    BillingJobs,
    { provide: BILLING_NOTIFIER, useClass: LogBillingNotifier }, // swap for an SMS/WhatsApp sender later
    { provide: PAYMENT_PROVIDER, useClass: ManualPaymentProvider }, // swap for a gateway later
    // Runs on EVERY route: expired businesses become read-only.
    { provide: APP_GUARD, useClass: SubscriptionGuard },
  ],
  exports: [SubscriptionStateService, AdminBillingService],
})
export class BillingModule {}
