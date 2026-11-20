'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  productName: string;
  onPricesAndPacks: () => void;
  onEdit: () => void;
  onArchive: () => void;
};

const MENU_WIDTH = 176; // w-44
const MENU_HEIGHT = 140; // approx., used only to decide whether to open upwards

/**
 * "Actions" menu for an active product row.
 * The menu is positioned with `fixed` so the table's rounded/overflow-hidden wrapper
 * never clips it (important for the last rows). Closes on outside click, Escape, scroll, resize.
 */
export function ProductActionsMenu({ productName, onPricesAndPacks, onEdit, onArchive }: Props) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const open = pos !== null;

  const toggle = () => {
    if (open) {
      setPos(null);
      return;
    }
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const openUp = r.bottom + MENU_HEIGHT > window.innerHeight && r.top > MENU_HEIGHT;
    setPos({
      top: openUp ? r.top - MENU_HEIGHT - 4 : r.bottom + 4,
      left: Math.max(8, Math.min(r.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)),
    });
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setPos(null);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        btnRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const item = 'block w-full text-left px-3 py-2 text-sm hover:bg-slate-50 focus:bg-slate-50 focus:outline-none';
  const run = (fn: () => void) => () => {
    setPos(null);
    fn();
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${productName}`}
        className="rounded-lg border border-slate-300 px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-50"
      >
        Actions ▾
      </button>
      {pos && (
        <div
          ref={menuRef}
          role="menu"
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: MENU_WIDTH }}
          className="z-40 rounded-lg border border-slate-200 bg-white shadow-lg py-1 text-left"
        >
          <button role="menuitem" className={item} onClick={run(onEdit)}>
            Edit product
          </button>
          <button role="menuitem" className={item} onClick={run(onPricesAndPacks)}>
            Prices &amp; packs
          </button>
          <div className="my-1 border-t border-slate-100" />
          <button role="menuitem" className={`${item} text-red-600`} onClick={run(onArchive)}>
            Archive product
          </button>
        </div>
      )}
    </>
  );
}
