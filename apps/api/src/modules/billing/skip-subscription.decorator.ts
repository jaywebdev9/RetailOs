import { SetMetadata } from '@nestjs/common';

export const SKIP_SUBSCRIPTION_KEY = 'skipSubscription';

/** Routes that must work even when the subscription has expired (login, billing, admin). */
export const SkipSubscription = () => SetMetadata(SKIP_SUBSCRIPTION_KEY, true);
