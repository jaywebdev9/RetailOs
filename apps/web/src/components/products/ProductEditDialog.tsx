'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import {
  ProductLike,
  ProductFormState,
  FormErrors,
  toFormState,
  validate,
  buildPatch,
  apiErrorMessage,
} from './productForm';

type Option = { id: string; name: string; symbol?: string | null };

type Props = {
  product: ProductLike;
  businessId: string;
  onClose: () => void;
  onSaved: (name: string) => void;
};

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:bg-slate-100';

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-slate-600 mb-1">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-err`} className="mt-1 text-xs text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

export function ProductEditDialog({ product, businessId, onClose, onSaved }: Props) {
  const original = useMemo(() => toFormState(product), [product]);
  const [form, setForm] = useState<ProductFormState>(original);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Option[]>([]);
  const [units, setUnits] = useState<Option[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const submitting = useRef(false); // blocks double submits even before state re-renders
  const firstField = useRef<HTMLInputElement>(null);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    firstField.current?.focus(); // once, when the dialog opens
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting.current) onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/products/catalog/options', { headers: { 'x-business-id': businessId } })
      .then((res) => {
        if (cancelled) return;
        setCategories(res.data.categories || []);
        setUnits(res.data.units || []);
      })
      .catch(() => {
        /* dropdowns stay empty; the current category/unit is kept untouched */
      })
      .finally(() => !cancelled && setOptionsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const set = <K extends keyof ProductFormState>(k: K, v: ProductFormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const patch = useMemo(() => buildPatch(original, form), [original, form]);
  const hasChanges = Object.keys(patch).length > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
    setServerError(null);

    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (!hasChanges) {
      onClose();
      return;
    }

    submitting.current = true;
    setSaving(true);
    try {
      await api.patch(`/products/${product.id}`, patch, {
        headers: { 'x-business-id': businessId },
      });
      onSaved(form.name.trim());
    } catch (err: any) {
      const message = apiErrorMessage(err, 'Could not save the product');
      if (err?.response?.status === 409) {
        // Point at the offending field when the server says which one
        if (/sku/i.test(message)) setErrors((x) => ({ ...x, sku: message }));
        else if (/barcode/i.test(message)) setErrors((x) => ({ ...x, barcode: message }));
      }
      setServerError(message);
      submitting.current = false;
      setSaving(false);
    }
  };

  const belowMin =
    form.minimumSellingPrice.trim() !== '' &&
    form.sellingPrice.trim() !== '' &&
    Number(form.sellingPrice) < Number(form.minimumSellingPrice);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-product-title"
    >
      <form
        onSubmit={submit}
        noValidate
        className="bg-white w-full sm:max-w-3xl max-h-[95vh] flex flex-col rounded-t-2xl sm:rounded-2xl shadow-xl"
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 id="edit-product-title" className="text-base font-semibold">
            Edit product
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="text-slate-500 hover:text-slate-800 text-xl leading-none disabled:opacity-40"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto space-y-5">
          {serverError && (
            <div role="alert" className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">
              {serverError}
            </div>
          )}

          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Field id="ep-name" label="Product name *" error={errors.name}>
                <input
                  id="ep-name"
                  ref={firstField}
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  disabled={saving}
                  aria-invalid={!!errors.name}
                  className={inputCls}
                />
              </Field>
            </div>
            <Field id="ep-sku" label="SKU" error={errors.sku}>
              <input id="ep-sku" value={form.sku} onChange={(e) => set('sku', e.target.value)}
                disabled={saving} aria-invalid={!!errors.sku} className={inputCls} />
            </Field>
            <Field id="ep-barcode" label="Barcode" error={errors.barcode}>
              <input id="ep-barcode" value={form.barcode} onChange={(e) => set('barcode', e.target.value)}
                disabled={saving} aria-invalid={!!errors.barcode} className={inputCls} />
            </Field>
            <Field id="ep-category" label="Category">
              <select id="ep-category" value={form.categoryId}
                onChange={(e) => set('categoryId', e.target.value)}
                disabled={saving || optionsLoading} className={inputCls}>
                <option value="">{optionsLoading ? 'Loading…' : 'No category'}</option>
                {/* keep the current value selectable even if the list could not load */}
                {form.categoryId && !categories.some((c) => c.id === form.categoryId) && (
                  <option value={form.categoryId}>Current category</option>
                )}
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
            <Field id="ep-unit" label="Unit">
              <select id="ep-unit" value={form.unitId}
                onChange={(e) => set('unitId', e.target.value)}
                disabled={saving || optionsLoading} className={inputCls}>
                <option value="">{optionsLoading ? 'Loading…' : 'No unit'}</option>
                {form.unitId && !units.some((u) => u.id === form.unitId) && (
                  <option value={form.unitId}>Current unit</option>
                )}
                {units.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}{u.symbol ? ` (${u.symbol})` : ''}</option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field id="ep-desc" label="Description">
                <textarea id="ep-desc" rows={2} value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  disabled={saving} className={inputCls} />
              </Field>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-medium mb-2">Pricing</h3>
            <p className="text-xs text-slate-500 mb-3">
              New prices apply to future sales and purchases only. Past invoices, sales and profit
              figures do not change.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field id="ep-cost" label="Cost price *" error={errors.costPrice}>
                <input id="ep-cost" type="number" inputMode="decimal" min="0" step="any"
                  value={form.costPrice} onChange={(e) => set('costPrice', e.target.value)}
                  disabled={saving} aria-invalid={!!errors.costPrice} className={inputCls} />
              </Field>
              <Field id="ep-sell" label="Selling price *" error={errors.sellingPrice}>
                <input id="ep-sell" type="number" inputMode="decimal" min="0" step="any"
                  value={form.sellingPrice} onChange={(e) => set('sellingPrice', e.target.value)}
                  disabled={saving} aria-invalid={!!errors.sellingPrice} className={inputCls} />
              </Field>
              <Field id="ep-min" label="Minimum selling price" error={errors.minimumSellingPrice}
                hint="Leave empty for no floor">
                <input id="ep-min" type="number" inputMode="decimal" min="0" step="any"
                  value={form.minimumSellingPrice} onChange={(e) => set('minimumSellingPrice', e.target.value)}
                  disabled={saving} aria-invalid={!!errors.minimumSellingPrice} className={inputCls} />
              </Field>
              <Field id="ep-wprice" label="Wholesale price" error={errors.wholesalePrice}
                hint="Per base unit. Leave empty for none">
                <input id="ep-wprice" type="number" inputMode="decimal" min="0" step="any"
                  value={form.wholesalePrice} onChange={(e) => set('wholesalePrice', e.target.value)}
                  disabled={saving} aria-invalid={!!errors.wholesalePrice} className={inputCls} />
              </Field>
              <Field id="ep-wqty" label="Wholesale minimum quantity" error={errors.wholesaleMinQty}
                hint="Anyone buying at least this much gets the wholesale price">
                <input id="ep-wqty" type="number" inputMode="decimal" min="0" step="any"
                  value={form.wholesaleMinQty} onChange={(e) => set('wholesaleMinQty', e.target.value)}
                  disabled={saving} aria-invalid={!!errors.wholesaleMinQty} className={inputCls} />
              </Field>
            </div>
            {belowMin && (
              <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                The selling price is below the minimum selling price. You can still save, but check
                the numbers.
              </p>
            )}
          </section>

          <section>
            <h3 className="text-sm font-medium mb-2">Stock rules</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field id="ep-rl" label="Reorder level *" error={errors.reorderLevel}>
                <input id="ep-rl" type="number" inputMode="decimal" min="0" step="any"
                  value={form.reorderLevel} onChange={(e) => set('reorderLevel', e.target.value)}
                  disabled={saving} aria-invalid={!!errors.reorderLevel} className={inputCls} />
              </Field>
              <Field id="ep-rq" label="Reorder quantity *" error={errors.reorderQuantity}>
                <input id="ep-rq" type="number" inputMode="decimal" min="0" step="any"
                  value={form.reorderQuantity} onChange={(e) => set('reorderQuantity', e.target.value)}
                  disabled={saving} aria-invalid={!!errors.reorderQuantity} className={inputCls} />
              </Field>
            </div>
            <div className="mt-3 space-y-2">
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={form.trackInventory} disabled={saving}
                  onChange={(e) => set('trackInventory', e.target.checked)} className="mt-0.5" />
                <span>Track inventory</span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={form.allowNegativeStock} disabled={saving}
                  onChange={(e) => set('allowNegativeStock', e.target.checked)} className="mt-0.5" />
                <span>Allow negative stock</span>
              </label>
              <p className="text-xs text-slate-400">
                Editing a product never changes its stock quantity. Use a stock adjustment or count for that.
              </p>
            </div>
          </section>
        </div>

        <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
