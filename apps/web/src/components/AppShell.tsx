'use client';

import { useEffect, useState, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowDownRight, Banknote, Boxes, BriefcaseBusiness, ChartNoAxesCombined,
  ChevronDown, CircleHelp, CreditCard, LayoutDashboard, LogOut, Menu,
  Package, ReceiptText, ShoppingBag, ShoppingCart, Truck, Users, Wallet,
  Warehouse, X, ArrowRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n } from '@/i18n';
import { clsx } from 'clsx';

const NAV_GROUPS = [
  {
    title: 'Workspace',
    items: [
      { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
      { href: '/pos', label: 'Point of sale', icon: ShoppingCart },
      { href: '/products', label: 'Products & stock', icon: Package },
    ],
  },
  {
    title: 'Manage business',
    items: [
      { href: '/sales', label: 'Sales', icon: ReceiptText },
      { href: '/purchases', label: 'Purchases', icon: ShoppingBag },
      { href: '/customers', label: 'Customers', icon: Users },
      { href: '/suppliers', label: 'Suppliers', icon: Truck },
      { href: '/expenses', label: 'Expenses', icon: Wallet },
      { href: '/cash', label: 'Cash management', icon: Banknote },
      { href: '/stock-count', label: 'Stock count', icon: Boxes },
      { href: '/returns', label: 'Returns', icon: ArrowDownRight },
    ],
  },
  {
    title: 'Insights & account',
    items: [
      { href: '/reports', label: 'Reports & analytics', icon: ChartNoAxesCombined },
      { href: '/billing', label: 'Plan & billing', icon: CreditCard },
    ],
  },
];

type AppShellProps = {
  children: ReactNode;
  title: string;
  subtitle?: string;
  breadcrumb?: string;
  actions?: ReactNode;
  /** When true, content area uses max-w-7xl; default is full width of shell */
  narrow?: boolean;
};

export function AppShell({
  children,
  title,
  subtitle,
  breadcrumb = 'Workspace',
  actions,
  narrow = false,
}: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [businessName, setBusinessName] = useState('Your business');
  const [user, setUser] = useState<{ firstName?: string; lastName?: string } | null>(null);
  const [ready, setReady] = useState(false);
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
          setBusinessName(memberships[0].business.name || 'Your business');
          localStorage.setItem('businessId', bid);
        }
      } catch {
        // keep UI usable; page-level auth may also redirect
      } finally {
        setReady(true);
      }
    })();
  }, [router]);

  // Lock body scroll when mobile nav is open
  useEffect(() => {
    if (mobileNavOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
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

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      <div
        className="flex h-[72px] shrink-0 items-center gap-3 border-b border-white/10 px-5"
        style={mobile ? { paddingTop: 'max(0px, env(safe-area-inset-top))' } : undefined}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-400 text-slate-950 shadow-sm">
          <Warehouse size={22} />
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-bold tracking-tight text-white">
            Retail<span className="text-teal-300">OS</span>
          </p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Business suite
          </p>
        </div>
        {mobile && (
          <button
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
            className="ml-auto flex h-11 w-11 items-center justify-center rounded-xl text-slate-300 hover:bg-white/10"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scroll-smooth-y px-3 py-5">
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/15 text-teal-300">
            <BriefcaseBusiness size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">{businessName}</p>
            <p className="mt-1 text-[10px] text-slate-400">Active workspace</p>
          </div>
          <ChevronDown size={15} className="shrink-0 text-slate-400" />
        </div>

        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="mb-5">
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
              {group.title}
            </p>
            <nav className="space-y-1">
              {group.items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname?.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileNavOpen(false)}
                    className={clsx(
                      'group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition',
                      active
                        ? 'bg-teal-400 text-slate-950 shadow-sm shadow-teal-950/20'
                        : 'text-slate-300 hover:bg-white/[0.07] hover:text-white',
                    )}
                  >
                    <Icon size={17} strokeWidth={active ? 2.3 : 1.8} />
                    <span className="flex-1">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      <div
        className="shrink-0 p-3"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
            <CircleHelp size={15} className="text-teal-300" />
            Need help?
          </div>
          <p className="mt-1.5 text-[11px] leading-5 text-slate-400">
            Manage your shop with confidence.
          </p>
          <Link
            href="/reports"
            onClick={() => setMobileNavOpen(false)}
            className="mt-2 inline-flex min-h-0 items-center gap-1 text-xs font-semibold text-teal-300"
          >
            View business reports <ArrowRight size={13} />
          </Link>
        </div>
        <button
          onClick={signOut}
          className="mt-3 flex w-full min-h-11 items-center gap-3 rounded-xl px-3 py-3 text-left text-xs font-medium text-slate-400 hover:bg-white/[0.07] hover:text-white"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-slate-900">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col bg-[var(--sidebar)] lg:flex">
        <SidebarContent />
      </aside>

      {/* Mobile nav drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close navigation overlay"
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-[3px]"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative flex h-full w-[min(88vw,320px)] flex-col overflow-hidden bg-[var(--sidebar)] shadow-2xl">
            <SidebarContent mobile />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="lg:pl-[260px]">
        <header
          className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/92 backdrop-blur-md"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <div className="flex h-14 min-h-[56px] items-center justify-between gap-2 px-3 sm:h-16 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open menu"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-xs hover:bg-slate-50 lg:hidden"
              >
                <Menu size={20} />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400">
                  <span className="hidden sm:inline">{breadcrumb}</span>
                  <span className="hidden sm:inline">/</span>
                  <span className="truncate text-slate-600">{title}</span>
                </div>
                <h1 className="mt-0.5 truncate text-[15px] font-bold tracking-tight sm:text-lg">
                  {title}
                </h1>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
              {actions && (
                <div className="flex items-center gap-1.5 sm:gap-2">{actions}</div>
              )}
              <button
                type="button"
                onClick={() => setLocale(locale === 'en' ? 'sw' : 'en')}
                className="hidden min-h-0 rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50 sm:inline-flex"
              >
                {locale === 'en' ? 'SW' : 'EN'}
              </button>
              <div className="hidden h-8 w-px bg-slate-200 sm:block" />
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d8f4ed] text-xs font-bold text-teal-900 ring-2 ring-white">
                {ready ? initials : '…'}
              </div>
              <div className="hidden min-w-0 sm:block">
                <p className="max-w-32 truncate text-xs font-semibold text-slate-800">
                  {displayName}
                </p>
                <p className="text-[10px] text-slate-500">Business account</p>
              </div>
            </div>
          </div>
        </header>

        <main
          className={clsx(
            'mx-auto w-full px-3 py-4 pb-safe sm:px-6 sm:py-7 lg:px-8 lg:py-8',
            narrow ? 'max-w-7xl' : 'max-w-[1500px]',
          )}
        >
          {subtitle && (
            <p className="mb-4 text-sm text-slate-500 sm:mb-6">{subtitle}</p>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

/** Status badge used across list pages */
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
    success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
    warning: 'bg-amber-50 text-amber-700 ring-1 ring-amber-100',
    danger: 'bg-rose-50 text-rose-700 ring-1 ring-rose-100',
    info: 'bg-sky-50 text-sky-700 ring-1 ring-sky-100',
  };
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        styles[t],
      )}
    >
      {status}
    </span>
  );
}

/** Empty state */
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
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center shadow-xs">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
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

/** Stat / KPI card for dashboards */
export function KpiCard({
  label,
  value,
  hint,
  icon,
  tone = 'teal',
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  tone?: 'teal' | 'blue' | 'violet' | 'amber' | 'rose' | 'emerald';
}) {
  const tones: Record<string, string> = {
    teal: 'bg-teal-50 text-teal-700',
    blue: 'bg-blue-50 text-blue-700',
    violet: 'bg-violet-50 text-violet-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  };
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </p>
        {icon && (
          <span className={clsx('flex h-9 w-9 items-center justify-center rounded-xl', tones[tone])}>
            {icon}
          </span>
        )}
      </div>
      <p className="mt-2 text-xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-2xl">
        {value}
      </p>
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}
