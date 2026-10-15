import { Injectable } from '@nestjs/common';
import { logger } from '../../common/logger';

export type BillingMessage = {
  businessId: string;
  businessName: string;
  ownerName: string;
  ownerPhone?: string | null;
  ownerEmail?: string | null;
  kind: 'D7' | 'D3' | 'D1' | 'EXPIRED';
  daysLeft: number;
  text: string;
};

/**
 * Hook for outgoing reminders (SMS / WhatsApp / email).
 * The default implementation only writes to the log. To send real messages, create a class that
 * implements BillingNotifier (call your SMS or WhatsApp provider inside send()) and register it
 * for the BILLING_NOTIFIER token in billing.module.ts.
 */
export interface BillingNotifier {
  send(message: BillingMessage): Promise<void>;
}

export const BILLING_NOTIFIER = 'BILLING_NOTIFIER';

@Injectable()
export class LogBillingNotifier implements BillingNotifier {
  async send(message: BillingMessage): Promise<void> {
    logger.info('Billing reminder (log only)', {
      businessId: message.businessId,
      kind: message.kind,
      to: message.ownerPhone || message.ownerEmail || 'no contact',
      text: message.text,
    });
  }
}
