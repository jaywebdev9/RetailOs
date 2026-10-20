'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight,
  Banknote, Bell, Boxes, BriefcaseBusiness, ChartNoAxesCombined, ChevronDown,
  CircleHelp, ClipboardList, CreditCard, Gauge, LayoutDashboard,
  LogOut, Menu, Package, ReceiptText, Search, ShoppingBag,
  ShoppingCart, Truck, Users, Wallet, Warehouse, X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n } from '@/i18n';

type AlertRow = {
  id: string;
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  body: string | null;
  referenceType: string | null;
  referenceId: string | null;
};

type DashboardData = {
  today: { sales: number; grossProfit: number; transactions: number };
  alerts: { lowStock: number; customerDebt: number; supplierDebt: number };
};

const NAV_GROUPS = [
  { title: 'Workspace', items: [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/pos', label: 'Point of sale', icon: ShoppingCart },
    { href: '/products', label: 'Products & stock', icon: Package },
  ]},
  { title: 'Manage business', items: [
    { href: '/sales', label: 'Sales', icon: ReceiptText },
    { href: '/purchases', label: 'Purchases', icon: ShoppingBag },
    { href: '/customers', label: 'Customers', icon: Users },
    { href: '/suppliers', label: 'Suppliers', icon: Truck },
    { href: '/expenses', label: 'Expenses', icon: Wallet },
    { href: '/cash', label: 'Cash management', icon: Banknote },
    { href: '/stock-count', label: 'Stock count', icon: Boxes },
    { href: '/returns', label: 'Returns', icon: ArrowDownRight },
  ]},
  { title: 'Insights & account', items: [
    { href: '/reports', label: 'Reports & analytics', icon: ChartNoAxesCombined },
    { href: '/billing', label: 'Plan & billing', icon: CreditCard },
  ]},
];

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState('Your business');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [alertRows, setAlertRows] = useState<AlertRow[]>([]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
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
          setBusinessId(bid);
          setBusinessName(memberships[0].business.name || 'Your business');
          localStorage.setItem('businessId', bid);
          const dash = await api.get('/reports/dashboard', {
            headers: { 'x-business-id': bid },
          });
          setData(dash.data);
          api.get('/alerts', { headers: { 'x-business-id': bid } })
            .then((r) => setAlertRows(r.data || []))
            .catch(() => {});
        }
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        router.push('/login');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const formatMoney = (n: number) => new Intl.NumberFormat('en-TZ', {
    style: 'currency', currency: 'TZS', maximumFractionDigits: 0,
  }).format(n);
  const todayLabel = useMemo(() => new Intl.DateTimeFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ', {
    weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
  }).format(new Date()), [locale]);
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Account';
  const initials = displayName.split(/\s+/).map((part: string) => part[0]).join('').slice(0, 2).toUpperCase();

  const signOut = () => {
    localStorage.clear();
    router.push('/login');
  };

  if (loading) {
    return <div className="min-h-screen bg-[#f6f8fb] p-6"><div className="mx-auto max-w-7xl animate-pulse space-y-5"><div className="h-14 rounded-2xl bg-white"/><div className="h-10 w-64 rounded-xl bg-slate-200"/><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[1,2,3,4].map((n) => <div key={n} className="h-32 rounded-2xl bg-white"/> )}</div></div></div>;
  }

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      <div className="flex h-[76px] items-center gap-3 border-b border-white/10 px-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-400 text-slate-950"><Warehouse size={22}/></div>
        <div className="min-w-0"><p className="text-[15px] font-bold tracking-tight text-white">Retail<span className="text-teal-300">OS</span></p><p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Business suite</p></div>
        {mobile && <button onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" className="ml-auto rounded-lg p-2 text-slate-300 hover:bg-white/10"><X size={20}/></button>}
      </div>
      <div className="px-3 py-5">
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/15 text-teal-300"><BriefcaseBusiness size={18}/></div>
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-white">{businessName}</p><p className="mt-1 text-[10px] text-slate-400">Active workspace</p></div><ChevronDown size={15} className="text-slate-400"/>
        </div>
        {NAV_GROUPS.map((group) => <div key={group.title} className="mb-5">
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{group.title}</p>
          <nav className="space-y-1">{group.items.map((item) => {
            const active = item.href === '/dashboard';
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} onClick={() => setMobileNavOpen(false)} className={`group flex min-h-10 items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition ${active ? 'bg-teal-400 text-slate-950 shadow-sm shadow-teal-950/20' : 'text-slate-300 hover:bg-white/[0.07] hover:text-white'}`}>
              <Icon size={17} strokeWidth={active ? 2.3 : 1.8}/><span className="flex-1">{item.label}</span>{item.href === '/products' && data?.alerts.lowStock ? <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-slate-950/10' : 'bg-amber-400/15 text-amber-300'}`}>{data.alerts.lowStock}</span> : null}
            </Link>;
          })}</nav>
        </div>)}
      </div>
      <div className="mt-auto p-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3"><div className="flex items-center gap-2 text-xs font-semibold text-slate-200"><CircleHelp size={15} className="text-teal-300"/>Need help?</div><p className="mt-1.5 text-[11px] leading-5 text-slate-400">Manage your shop with confidence.</p><Link href="/reports" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-teal-300">View business reports <ArrowRight size={13}/></Link></div>
        <button onClick={signOut} className="mt-3 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-xs font-medium text-slate-400 hover:bg-white/[0.07] hover:text-white"><LogOut size={16}/>Sign out</button>
      </div>
    </>
  );

  const stats = [
    { label: "Today's sales", value: data ? formatMoney(data.today.sales) : '—', note: 'Recorded sales today', icon: Banknote, color: 'teal', trend: null },
    { label: 'Gross profit today', value: data ? formatMoney(data.today.grossProfit) : '—', note: 'Before operating expenses', icon: ChartNoAxesCombined, color: 'violet', trend: null },
    { label: 'Transactions', value: data?.today.transactions ?? '—', note: 'Sales completed today', icon: ReceiptText, color: 'blue', trend: null },
    { label: 'Low-stock items', value: data?.alerts.lowStock ?? '—', note: 'Products to review', icon: AlertTriangle, color: 'amber', trend: null },
  ];
  const colorStyles: Record<string, string> = { teal: 'bg-teal-50 text-teal-700 ring-teal-100', violet: 'bg-violet-50 text-violet-700 ring-violet-100', blue: 'bg-blue-50 text-blue-700 ring-blue-100', amber: 'bg-amber-50 text-amber-700 ring-amber-100' };

  return <div className="min-h-screen bg-[#f6f8fb] text-slate-900">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[258px] flex-col bg-[#101d2b] lg:flex"><SidebarContent/></aside>
    {mobileNavOpen && <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Close navigation overlay" className="absolute inset-0 bg-slate-950/50" onClick={() => setMobileNavOpen(false)}/><aside className="relative flex h-full w-[min(86vw,300px)] flex-col overflow-y-auto bg-[#101d2b] shadow-2xl"><SidebarContent mobile/></aside></div>}

    <div className="min-w-0 lg:pl-[258px]">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="flex h-[72px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setMobileNavOpen(true)} aria-label="Open navigation" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 lg:hidden"><Menu size={20}/></button>
            <div className="min-w-0"><div className="flex items-center gap-2 text-[11px] font-medium text-slate-400"><span>Workspace</span><span>/</span><span className="text-slate-600">Overview</span></div><h1 className="mt-0.5 truncate text-base font-bold tracking-tight sm:text-lg">Business overview</h1></div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 xl:flex"><Search size={14}/><span>Search workspace</span><span className="ml-3 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px]">⌘ K</span></div>
            <button onClick={() => setLocale(locale === 'en' ? 'sw' : 'en')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50">{locale === 'en' ? 'SW' : 'EN'}</button>
            <button onClick={() => document.getElementById('attention-panel')?.scrollIntoView({ behavior: 'smooth' })} aria-label="View alerts" className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"><Bell size={18}/>{alertRows.length > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-rose-500"/>}</button>
            <div className="hidden h-8 w-px bg-slate-200 sm:block"/><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d8f4ed] text-xs font-bold text-teal-900">{initials}</div><div className="hidden min-w-0 sm:block"><p className="max-w-32 truncate text-xs font-semibold text-slate-800">{displayName}</p><p className="text-[10px] text-slate-500">Business account</p></div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        <section className="mb-6 flex flex-col justify-between gap-4 sm:mb-7 sm:flex-row sm:items-end">
          <div><p className="text-xs font-medium text-slate-500">{todayLabel}</p><h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-[30px]">Good to see you{user?.firstName ? `, ${user.firstName}` : ''}.</h2><p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">Here is what is happening in your business today.</p></div>
          <div className="flex flex-wrap gap-2"><Link href="/products" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"><Package size={15}/> Add or manage products</Link><Link href="/pos" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-xs font-semibold text-white shadow-sm shadow-teal-900/10 transition hover:bg-teal-800"><ShoppingCart size={15}/> Open POS <ArrowUpRight size={14}/></Link></div>
        </section>

        {!businessId && <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5"><div className="flex items-start gap-3"><AlertTriangle size={20} className="mt-0.5 text-amber-700"/><div className="flex-1"><p className="font-semibold text-amber-950">Set up your business to get started</p><p className="mt-1 text-sm text-amber-800">Add your business details to start managing products, sales and stock.</p><Link href="/onboarding" className="mt-3 inline-flex rounded-lg bg-amber-900 px-3 py-2 text-xs font-semibold text-white">Set up business <ArrowRight size={14} className="ml-2"/></Link></div></div></div>}

        <section className="mb-7 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 2xl:grid-cols-4">
          {stats.map((stat) => { const Icon = stat.icon; return <article key={stat.label} className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.025)] transition hover:-translate-y-0.5 hover:shadow-md sm:p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-medium text-slate-500 sm:text-[13px]">{stat.label}</p><p className="mt-3 break-words text-[23px] font-bold tracking-tight text-slate-950 sm:text-[26px]">{stat.value}</p></div><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${colorStyles[stat.color]}`}><Icon size={19}/></div></div><div className="mt-4 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-[11px] text-slate-500"><Activity size={13} className="text-slate-400"/>{stat.note}</div></article>; })}
        </section>

        <section className="mb-7 grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr_1fr]">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.025)] sm:p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-900">Business health</h3><p className="mt-1 text-xs leading-5 text-slate-500">A quick view of money owed and stock that needs attention.</p></div><span className="rounded-lg bg-slate-50 p-2 text-slate-500"><Gauge size={17}/></span></div>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2"><div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4"><div className="flex items-center gap-2 text-xs font-medium text-slate-500"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700"><ArrowDownRight size={15}/></span>Customer debt</div><p className="mt-3 text-xl font-bold tracking-tight text-slate-900">{data ? formatMoney(data.alerts.customerDebt) : '—'}</p><Link href="/customers" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900">Review customers <ArrowRight size={13}/></Link></div><div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4"><div className="flex items-center gap-2 text-xs font-medium text-slate-500"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-violet-700"><ArrowUpRight size={15}/></span>Supplier debt</div><p className="mt-3 text-xl font-bold tracking-tight text-slate-900">{data ? formatMoney(data.alerts.supplierDebt) : '—'}</p><Link href="/suppliers" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900">Review suppliers <ArrowRight size={13}/></Link></div></div>
          </div>
          <div id="attention-panel" className="scroll-mt-24 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.025)] sm:p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-900">Needs attention</h3><p className="mt-1 text-xs text-slate-500">Alerts that may need action.</p></div><span className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700">{alertRows.length}</span></div>
            {alertRows.length === 0 ? <div className="flex min-h-[142px] flex-col items-center justify-center py-6 text-center"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-50 text-teal-700"><Activity size={19}/></div><p className="mt-3 text-xs font-semibold text-slate-700">You are all caught up</p><p className="mt-1 max-w-[220px] text-[11px] leading-5 text-slate-500">New stock, account or subscription alerts will appear here.</p></div> : <ul className="mt-3 divide-y divide-slate-100">{alertRows.slice(0, 5).map((alert) => <li key={alert.id} className="flex items-start gap-3 py-3"><span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${alert.severity === 'CRITICAL' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}><AlertTriangle size={14}/></span><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-slate-800">{alert.title}</p>{alert.body && <p className="mt-1 text-[11px] leading-5 text-slate-500">{alert.body}</p>}</div>{alert.referenceType === 'SUBSCRIPTION' && <Link href="/billing" className="text-[11px] font-semibold text-teal-700">Renew</Link>}{alert.referenceType === 'CUSTOMER' && alert.referenceId && <Link href={`/customers/${alert.referenceId}/statement`} className="text-[11px] font-semibold text-teal-700">Statement</Link>}</li>)}</ul>}
          </div>
        </section>

        <section className="mb-7"><div className="mb-3 flex items-end justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-900">Quick actions</h3><p className="mt-1 text-xs text-slate-500">Jump straight into your everyday tasks.</p></div></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">{[
          { href: '/pos', label: 'New sale', detail: 'Checkout customer', icon: ShoppingCart, tone: 'teal' },
          { href: '/products', label: 'Products', detail: 'Catalog & prices', icon: Package, tone: 'blue' },
          { href: '/purchases', label: 'Record purchase', detail: 'Restock inventory', icon: ClipboardList, tone: 'violet' },
          { href: '/customers', label: 'Customers', detail: 'Profiles & balances', icon: Users, tone: 'amber' },
          { href: '/cash', label: 'Cash book', detail: 'Cash movements', icon: Banknote, tone: 'green' },
          { href: '/reports', label: 'View reports', detail: 'Business insights', icon: ChartNoAxesCombined, tone: 'rose' },
        ].map((action) => { const Icon = action.icon; const tones: Record<string,string> = { teal:'bg-teal-50 text-teal-700', blue:'bg-blue-50 text-blue-700', violet:'bg-violet-50 text-violet-700', amber:'bg-amber-50 text-amber-700', green:'bg-emerald-50 text-emerald-700', rose:'bg-rose-50 text-rose-700' }; return <Link key={action.href} href={action.href} className="group flex min-h-[122px] flex-col rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-[0_2px_8px_rgba(15,23,42,0.02)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md sm:p-4"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tones[action.tone]}`}><Icon size={18}/></span><span className="mt-3 text-xs font-bold text-slate-800">{action.label}</span><span className="mt-1 text-[10px] leading-4 text-slate-500">{action.detail}</span><ArrowRight size={14} className="mt-auto hidden self-end text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-teal-700 sm:block"/></Link>; })}</div></section>

        <footer className="flex flex-col gap-2 border-t border-slate-200/80 py-5 text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between"><span>Retail OS · Business management workspace</span><div className="flex items-center gap-4"><span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500"/>Workspace ready</span><Link href="/billing" className="hover:text-slate-600">Plan & billing</Link></div></footer>
      </main>
    </div>
  </div>;
}
