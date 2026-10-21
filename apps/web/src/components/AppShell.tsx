'use client';

import { useEffect, useState, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowDownRight, Banknote, Bell, Boxes, ChartNoAxesCombined,
  CreditCard, LayoutDashboard, LogOut, Menu, Package, ReceiptText,
  Search, ShoppingBag, ShoppingCart, Truck, Users, Wallet,
  Warehouse, X, Settings,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n } from '@/i18n';
import { clsx } from 'clsx';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pos', label: 'POS', icon: ShoppingCart },
  { href: '/products', label: 'Products', icon: Package },
  { href: '/sales', label: 'Orders', icon: ReceiptText },
  { href: '/purchases', label: 'Purchases', icon: ShoppingBag },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/suppliers', label: 'Suppliers', icon: Truck },
  { href: '/expenses', label: 'Expenses', icon: Wallet },
  { href: '/cash', label: 'Cash', icon: Banknote },
  { href: '/stock-count', label: 'Stock count', icon: Boxes },
  { href: '/returns', label: 'Returns', icon: ArrowDownRight },
  { href: '/reports', label: 'Reports', icon: ChartNoAxesCombined },
  { href: '/billing', label: 'Billing', icon: CreditCard },
];

const MOBILE_TABS = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/pos', label: 'POS', icon: ShoppingCart },
  { href: '/products', label: 'Stock', icon: Package },
  { href: '/sales', label: 'Orders', icon: ReceiptText },
  { href: '/reports', label: 'More', icon: ChartNoAxesCombined },
];

type AppShellProps = {
  children: ReactNode;
  title: string;
  subtitle?: string;
  breadcrumb?: string;
  actions?: ReactNode;
  narrow?: boolean;
  hideSearch?: boolean;
};

export function AppShell({
  children,
  title,
  subtitle,
  actions,
  narrow = false,
  hideSearch = false,
}: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [businessName, setBusinessName] = useState('Your store');
  const [user, setUser] = useState<{ firstName?: string; lastName?: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { locale, setLocale } = useI18n();

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
          const bid = memberships[0].business.id;
          setBusinessName(memberships[0].business.name || 'Your store');
          localStorage.setItem('businessId', bid);
        }
      } catch {
        /* keep UI usable */
      } finally {
        setReady(true);
      }
    })();
  }, [router]);

  useEffect(() => {
    document.body.style.overflow = mobileNavOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
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
    pathname === href || (href !== '/dashboard' && pathname?.startsWith(href));

  const SidebarNav = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      <div
        className="flex h-16 shrink-0 items-center gap-3 border-b border-[var(--sidebar-border)] px-5"
        style={mobile ? { paddingTop: 'max(0.75rem, env(safe-area-inset-top))' } : undefined}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)] text-white shadow-sm">
          <Warehouse size={18} strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold tracking-tight text-slate-900">
            Retail<span className="text-[var(--primary)]">OS</span>
          </p>
        </div>
        {mobile && (
          <button
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <nav className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileNavOpen(false)}
                className={clsx(
                  'group flex min-h-[42px] items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-all',
                  active
                    ? 'bg-[var(--primary)] text-white shadow-sm shadow-orange-500/25'
                    : 'text-slate-600 hover:bg-[var(--muted)] hover:text-slate-900',
                )}
              >
                <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div
        className="shrink-0 border-t border-[var(--sidebar-border)] p-3"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={signOut}
          className="flex w-full min-h-[42px] items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium text-slate-500 hover:bg-[var(--muted)] hover:text-slate-800"
        >
          <LogOut size={17} />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-slate-900">
      {/* Desktop sidebar — light */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[240px] flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] lg:flex">
        <SidebarNav />
      </aside>

      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close overlay"
            className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative flex h-full w-[min(85vw,300px)] flex-col bg-white shadow-2xl">
            <SidebarNav mobile />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="lg:pl-[240px]">
        {/* Top bar */}
        <header
          className="sticky top-0 z-20 border-b border-[var(--border)] bg-white/90 backdrop-blur-md"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <div className="flex h-14 items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Menu"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-white text-slate-700 lg:hidden"
            >
              <Menu size={20} />
            </button>

            {/* Search */}
            {!hideSearch && (
              <div className="relative hidden min-w-0 flex-1 sm:block sm:max-w-xs lg:max-w-sm">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  placeholder="Search products, orders, SKUs…"
                  className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--muted)] pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[var(--primary)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
            )}

            <div className="min-w-0 flex-1 sm:flex-none">
              <h1 className="truncate text-[15px] font-bold tracking-tight sm:text-base lg:hidden">
                {title}
              </h1>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              {actions}

              {/* Language */}
              <button
                type="button"
                onClick={() => setLocale(locale === 'en' ? 'sw' : 'en')}
                className="hidden h-9 items-center rounded-lg border border-[var(--border)] px-2.5 text-[11px] font-bold text-slate-600 hover:bg-[var(--muted)] sm:inline-flex"
              >
                {locale === 'en' ? 'SW' : 'EN'}
              </button>

              {/* Notifications */}
              <div className="relative">
                <button
                  type="button"
                  aria-label="Notifications"
                  onClick={() => setNotifOpen((v) => !v)}
                  className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-white text-slate-600 hover:bg-[var(--muted)]"
                >
                  <Bell size={18} />
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[var(--primary)] ring-2 ring-white" />
                </button>
                {notifOpen && (
                  <div className="absolute right-0 top-12 z-40 w-72 rounded-2xl border border-[var(--border)] bg-white p-3 shadow-[var(--shadow-elevated)]">
                    <p className="mb-2 text-xs font-bold text-slate-800">Notifications</p>
                    <div className="space-y-2">
                      <div className="rounded-xl bg-[var(--warning-soft)] px-3 py-2.5 text-xs text-amber-800">
                        Low stock items need attention
                      </div>
                      <div className="rounded-xl bg-[var(--info-soft)] px-3 py-2.5 text-xs text-blue-800">
                        New purchase order received
                      </div>
                    </div>
                    <button
                      type="button"
                      className="mt-2 w-full text-center text-[11px] font-semibold text-[var(--primary)]"
                      onClick={() => setNotifOpen(false)}
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>

              {/* Avatar + store */}
              <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white py-1 pl-1 pr-2.5 sm:pr-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-xs font-bold text-orange-700">
                  {ready ? initials : '…'}
                </div>
                <div className="hidden min-w-0 sm:block">
                  <p className="max-w-[100px] truncate text-xs font-semibold text-slate-800">
                    {businessName}
                  </p>
                  <p className="text-[10px] text-slate-400">Store</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main
          className={clsx(
            'mx-auto w-full px-3 py-4 pb-24 sm:px-6 sm:py-6 lg:px-8 lg:pb-8',
            narrow ? 'max-w-6xl' : 'max-w-[1400px]',
          )}
        >
          {/* Desktop page title */}
          <div className="mb-5 hidden items-end justify-between gap-3 lg:flex">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
              {subtitle && (
                <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
              )}
            </div>
          </div>
          {subtitle && (
            <p className="mb-4 text-sm text-slate-500 lg:hidden">{subtitle}</p>
          )}
          {children}
        </main>
      </div>

      {/* Mobile bottom tabs */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--border)] bg-white/95 backdrop-blur-md lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex h-14 items-stretch justify-around px-1">
          {MOBILE_TABS.map((tab) => {
            const active = isActive(tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={clsx(
                  'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold',
                  active ? 'text-[var(--primary)]' : 'text-slate-400',
                )}
              >
                <span
                  className={clsx(
                    'flex h-8 w-8 items-center justify-center rounded-xl transition',
                    active && 'bg-orange-50',
                  )}
                >
                  <Icon size={20} strokeWidth={active ? 2.3 : 1.8} />
                </span>
                <span className="truncate">{tab.label}</span>
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
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
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
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-white px-6 py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-400">
        <Package size={22} />
      </div>
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-xs leading-5 text-slate-500">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  trend,
  trendUp,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  trend?: string;
  trendUp?: boolean;
  icon?: ReactNode;
}) {
  return (
    <div className="card flex flex-col p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </p>
        {icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
            {icon}
          </span>
        )}
      </div>
      <p className="mt-2 text-xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-2xl">
        {value}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {trend && (
          <span
            className={clsx(
              'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
              trendUp ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600',
            )}
          >
            {trend}
          </span>
        )}
        {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
      </div>
    </div>
  );
}
