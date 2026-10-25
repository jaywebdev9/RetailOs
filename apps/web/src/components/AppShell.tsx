'use client';

import { useEffect, useState, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowDownRight,
  Banknote,
  Bell,
  Boxes,
  ChartNoAxesCombined,
  CircleHelp,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ReceiptText,
  Search,
  ShoppingBag,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  Warehouse,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n } from '@/i18n';
import { clsx } from 'clsx';

const NAV_ITEMS = [
  { href: '/dashboard', labelKey: 'dashboard' as const, icon: LayoutDashboard },
  { href: '/pos', labelKey: 'pos' as const, icon: ShoppingCart },
  { href: '/products', labelKey: 'products' as const, icon: Package },
  { href: '/sales', labelKey: 'sales' as const, icon: ReceiptText },
  { href: '/purchases', labelKey: 'purchases' as const, icon: ShoppingBag },
  { href: '/customers', labelKey: 'customers' as const, icon: Users },
  { href: '/suppliers', labelKey: 'suppliers' as const, icon: Truck },
  { href: '/expenses', labelKey: 'expenses' as const, icon: Wallet },
  { href: '/cash', labelKey: 'cash' as const, icon: Banknote },
  { href: '/stock-count', labelKey: 'stockCount' as const, icon: Boxes },
  { href: '/returns', labelKey: 'returns' as const, icon: ArrowDownRight },
  { href: '/reports', labelKey: 'reports' as const, icon: ChartNoAxesCombined },
  { href: '/billing', labelKey: 'billing' as const, icon: CreditCard },
  { href: '/help', labelKey: 'help' as const, icon: CircleHelp },
];

const MOBILE_TABS = [
  { href: '/dashboard', labelKey: 'home' as const, icon: LayoutDashboard },
  { href: '/pos', labelKey: 'posShort' as const, icon: ShoppingCart },
  { href: '/products', labelKey: 'stock' as const, icon: Package },
  { href: '/sales', labelKey: 'sales' as const, icon: ReceiptText },
  { href: '/help', labelKey: 'more' as const, icon: ChartNoAxesCombined },
];

type AppShellProps = {
  children: ReactNode;
  title: string;
  subtitle?: string;
  /** Optional breadcrumb label (kept for compatibility with list pages) */
  breadcrumb?: string;
  actions?: ReactNode;
  narrow?: boolean;
};

export function AppShell({
  children,
  title,
  subtitle,
  breadcrumb,
  actions,
  narrow = false,
}: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [businessName, setBusinessName] = useState('Your store');
  const [user, setUser] = useState<{ firstName?: string; lastName?: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { locale, setLocale, t } = useI18n();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push('/login');
      return;
    }
    (async () => {
      try {
        const [meRes, bizRes] = await Promise.all([
          api.get('/users/me'),
          api.get('/users/me/businesses'),
        ]);
        setUser(meRes.data);
        const memberships = bizRes.data;
        if (memberships?.length > 0) {
          localStorage.setItem('businessId', memberships[0].business.id);
          setBusinessName(memberships[0].business.name || 'Your store');
        }
      } catch {
        /* page-level auth may redirect */
      } finally {
        setReady(true);
      }
    })();
  }, [router]);

  useEffect(() => {
    if (mobileNavOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [mobileNavOpen]);

  const signOut = () => {
    localStorage.clear();
    router.push('/login');
  };

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Account';
  const initials = displayName
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && !!pathname?.startsWith(href));

  const SidebarNav = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      <div
        className="flex h-14 shrink-0 items-center gap-2.5 border-b border-slate-200 px-4"
        style={mobile ? { paddingTop: 'max(0.5rem, env(safe-area-inset-top))' } : undefined}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-white">
          <Warehouse size={16} />
        </div>
        <p className="truncate text-sm font-semibold text-slate-900">
          Retail<span className="text-teal-700">OS</span>
        </p>
        {mobile && (
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close menu"
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMobileNavOpen(false)}
                  className={clsx(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                    active
                      ? 'bg-teal-700 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  )}
                >
                  <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
                  {t(item.labelKey)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div
        className="shrink-0 border-t border-slate-200 p-2"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        >
          <LogOut size={16} />
          {t('signOut')}
        </button>
      </div>
    </>
  );

  return (
    <div className="bg-[#f6f8fb] text-slate-900">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-slate-200 bg-white lg:flex">
        <SidebarNav />
      </aside>

      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close overlay"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative flex h-full w-[min(80vw,280px)] flex-col bg-white shadow-xl">
            <SidebarNav mobile />
          </aside>
        </div>
      )}

      <div className="lg:pl-56">
        <header
          className="sticky top-0 z-20 border-b border-slate-200 bg-white"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <div className="flex h-12 items-center gap-2 px-3 sm:h-14 sm:px-5 lg:px-6">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-700 lg:hidden"
            >
              <Menu size={18} />
            </button>

            <div className="relative hidden min-w-0 flex-1 md:block md:max-w-xs">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                placeholder={t('search')}
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/15"
              />
            </div>

            <h1 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900 md:flex-none lg:text-base">
              {title}
            </h1>

            <div className="flex shrink-0 items-center gap-1.5">
              {actions}

              <button
                type="button"
                onClick={() => setLocale(locale === 'en' ? 'sw' : 'en')}
                aria-label="Change language"
                className="inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-bold text-teal-800 hover:bg-teal-50"
              >
                {locale === 'en' ? 'SW' : 'EN'}
              </button>

              <div className="relative">
                <button
                  type="button"
                  aria-label={t('notifications')}
                  onClick={() => setNotifOpen((v) => !v)}
                  className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  <Bell size={16} />
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-teal-600" />
                </button>
                {notifOpen && (
                  <div className="absolute right-0 top-11 z-40 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-md">
                    <p className="mb-2 text-xs font-semibold text-slate-800">{t('notifications')}</p>
                    <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      {t('notificationsHint')}
                    </p>
                    <button
                      type="button"
                      className="mt-2 w-full text-center text-[11px] font-semibold text-teal-700"
                      onClick={() => setNotifOpen(false)}
                    >
                      {t('close')}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-slate-200 py-1 pl-1 pr-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-50 text-[11px] font-bold text-teal-800">
                  {ready ? initials : '…'}
                </div>
                <span className="hidden max-w-[88px] truncate text-xs font-medium text-slate-700 sm:inline">
                  {businessName}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Content — natural document scroll; space for bottom tabs on mobile */}
        <main
          className={clsx(
            'mx-auto w-full px-3 pt-4 sm:px-5 sm:pt-5 lg:px-6 lg:pt-6',
            'pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:pb-8',
            narrow ? 'max-w-5xl' : 'max-w-[1280px]',
          )}
        >
          {subtitle && (
            <p className="mb-4 text-sm text-slate-500">{subtitle}</p>
          )}
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex h-14">
          {MOBILE_TABS.map((tab) => {
            const active = isActive(tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={clsx(
                  'flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium',
                  active ? 'text-teal-700' : 'text-slate-400',
                )}
              >
                <Icon size={20} strokeWidth={active ? 2.2 : 1.7} />
                {t(tab.labelKey)}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function StatusBadge({
  status,
  tone,
}: {
  status: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}) {
  const map: Record<string, string> = {
    RECEIVED: 'success',
    ORDERED: 'info',
    PENDING: 'warning',
    CANCELLED: 'danger',
    ACTIVE: 'success',
    INACTIVE: 'neutral',
  };
  const t = tone || map[status] || 'neutral';
  const styles: Record<string, string> = {
    neutral: 'bg-slate-100 text-slate-600',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-rose-50 text-rose-700',
    info: 'bg-sky-50 text-sky-700',
  };
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
        styles[t],
      )}
    >
      {status}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
        <Package size={20} />
      </div>
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="card animate-fade-in p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
          {label}
        </p>
        {icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
            {icon}
          </span>
        )}
      </div>
      <p className="mt-2 text-xl font-semibold tabular-nums tracking-tight text-slate-900">
        {value}
      </p>
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}
