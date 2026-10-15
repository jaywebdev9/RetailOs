import { SubscriptionBanner } from '@/components/SubscriptionBanner';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SubscriptionBanner />
      {children}
    </>
  );
}
