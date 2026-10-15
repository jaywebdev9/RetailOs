/**
 * Payment providers.
 *
 * MANUAL (today): the owner pays your mobile-money number, submits the transaction reference,
 *   and you confirm it on /admin/billing.
 *
 * A real gateway (Selcom, ClickPesa, Flutterwave...) later = implement this interface, then call
 * AdminBillingService.confirmPayment(paymentId, 'SYSTEM') from the gateway's webhook once the money
 * is verified. Nothing else in the app needs to change.
 */
export interface PaymentProvider {
  readonly code: string;
  /** Start an online payment and return where the owner should go to pay. Manual has no checkout. */
  createCheckout?(input: {
    paymentId: string;
    amountTzs: number;
    businessId: string;
    payerPhone?: string;
  }): Promise<{ checkoutUrl: string }>;
  /** Check a gateway webhook (signature etc.) and return the payment id it refers to. */
  verifyWebhook?(headers: Record<string, string>, body: unknown): Promise<{ paymentId: string; paid: boolean }>;
}

export class ManualPaymentProvider implements PaymentProvider {
  readonly code = 'MANUAL';
}

/** Placeholder so the wiring exists. Replace with a real implementation per gateway. */
export class GatewayStubProvider implements PaymentProvider {
  readonly code = 'GATEWAY_STUB';
  async createCheckout(): Promise<{ checkoutUrl: string }> {
    throw new Error('No payment gateway is configured yet');
  }
  async verifyWebhook(): Promise<{ paymentId: string; paid: boolean }> {
    throw new Error('No payment gateway is configured yet');
  }
}

export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';
