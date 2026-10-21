'use client';

import { ReactNode } from 'react';
import { clsx } from 'clsx';

/**
 * Renders card list on mobile (< md) and table on desktop.
 * Prevents horizontal cut-off on phones while keeping dense tables on large screens.
 */
export function ResponsiveList({
  mobile,
  desktop,
  className,
}: {
  mobile: ReactNode;
  desktop: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="mobile-list md:hidden">{mobile}</div>
      <div className="hidden md:block">{desktop}</div>
    </div>
  );
}

export function DataCard({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onClick();
            }
          : undefined
      }
      className={clsx(
        'rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]',
        onClick && 'cursor-pointer active:scale-[0.99] transition-transform',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DesktopTable({
  children,
  minWidth = 640,
}: {
  children: ReactNode;
  minWidth?: number;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <div className="table-scroll">
        <table
          className="w-full text-left text-sm"
          style={{ minWidth }}
        >
          {children}
        </table>
      </div>
    </div>
  );
}
