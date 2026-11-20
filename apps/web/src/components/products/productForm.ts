// Pure helpers for the Edit Product form (no React): kept separate so the rules are easy to read/test.

export type ProductLike = {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  description?: string | null;
  categoryId?: string | null;
  unitId?: string | null;
  costPrice: string | number;
  sellingPrice: string | number;
  minimumSellingPrice?: string | number | null;
  wholesalePrice?: string | number | null;
  wholesaleMinQty?: string | number | null;
  reorderLevel: string | number;
  reorderQuantity?: string | number | null;
  trackInventory?: boolean;
  allowNegativeStock?: boolean;
};

export type ProductFormState = {
  name: string;
  sku: string;
  barcode: string;
  description: string;
  categoryId: string;
  unitId: string;
  costPrice: string;
  sellingPrice: string;
  minimumSellingPrice: string;
  wholesalePrice: string;
  wholesaleMinQty: string;
  reorderLevel: string;
  reorderQuantity: string;
  trackInventory: boolean;
  allowNegativeStock: boolean;
};

export type FormErrors = Partial<Record<keyof ProductFormState, string>>;

const num = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === '' ? '' : String(Number(v));

/** Fill the form from the product exactly as stored (null stays empty, 0 stays "0"). */
export function toFormState(p: ProductLike): ProductFormState {
  return {
    name: p.name ?? '',
    sku: p.sku ?? '',
    barcode: p.barcode ?? '',
    description: p.description ?? '',
    categoryId: p.categoryId ?? '',
    unitId: p.unitId ?? '',
    costPrice: num(p.costPrice),
    sellingPrice: num(p.sellingPrice),
    minimumSellingPrice: num(p.minimumSellingPrice),
    wholesalePrice: num(p.wholesalePrice),
    wholesaleMinQty: num(p.wholesaleMinQty),
    reorderLevel: num(p.reorderLevel),
    reorderQuantity: num(p.reorderQuantity),
    trackInventory: p.trackInventory ?? true,
    allowNegativeStock: p.allowNegativeStock ?? false,
  };
}

const isBlank = (v: string) => v.trim() === '';
const isNonNegative = (v: string) => /^\d+(\.\d{1,4})?$/.test(v.trim());

export function validate(f: ProductFormState): FormErrors {
  const e: FormErrors = {};
  if (isBlank(f.name)) e.name = 'Product name is required';
  else if (f.name.trim().length > 255) e.name = 'Name is too long (max 255)';
  if (f.sku.trim().length > 100) e.sku = 'SKU is too long (max 100)';
  if (f.barcode.trim().length > 50) e.barcode = 'Barcode is too long (max 50)';

  const required: [keyof ProductFormState, string][] = [
    ['costPrice', 'Cost price'],
    ['sellingPrice', 'Selling price'],
    ['reorderLevel', 'Reorder level'],
    ['reorderQuantity', 'Reorder quantity'],
  ];
  for (const [k, label] of required) {
    const v = f[k] as string;
    if (isBlank(v)) e[k] = `${label} is required`;
    else if (!isNonNegative(v)) e[k] = `${label} must be a number 0 or more (max 4 decimals)`;
  }
  const optional: [keyof ProductFormState, string][] = [
    ['minimumSellingPrice', 'Minimum selling price'],
    ['wholesalePrice', 'Wholesale price'],
    ['wholesaleMinQty', 'Wholesale minimum quantity'],
  ];
  for (const [k, label] of optional) {
    const v = f[k] as string;
    if (!isBlank(v) && !isNonNegative(v)) e[k] = `${label} must be a number 0 or more (max 4 decimals)`;
  }
  return e;
}

/**
 * Build the PATCH body with ONLY the fields the user actually changed.
 * - untouched fields are never sent, so nothing is silently overwritten;
 * - a cleared optional field is sent as null (clears it); required ones are never sent empty.
 */
export function buildPatch(original: ProductFormState, current: ProductFormState) {
  const patch: Record<string, unknown> = {};
  const text = (k: 'name' | 'sku' | 'barcode' | 'description') => {
    if (current[k].trim() !== original[k].trim()) {
      patch[k] = k === 'name' ? current[k].trim() : current[k].trim() === '' ? null : current[k].trim();
    }
  };
  (['name', 'sku', 'barcode', 'description'] as const).forEach(text);

  for (const k of ['categoryId', 'unitId'] as const) {
    if (current[k] !== original[k]) patch[k] = current[k] === '' ? null : current[k];
  }
  for (const k of ['costPrice', 'sellingPrice', 'reorderLevel', 'reorderQuantity'] as const) {
    if (Number(current[k]) !== Number(original[k])) patch[k] = Number(current[k]);
  }
  for (const k of ['minimumSellingPrice', 'wholesalePrice', 'wholesaleMinQty'] as const) {
    if (current[k].trim() !== original[k].trim()) {
      patch[k] = current[k].trim() === '' ? null : Number(current[k]);
    }
  }
  for (const k of ['trackInventory', 'allowNegativeStock'] as const) {
    if (current[k] !== original[k]) patch[k] = current[k];
  }
  return patch;
}

export function apiErrorMessage(err: any, fallback: string): string {
  const status = err?.response?.status;
  const msg = err?.response?.data?.message;
  if (status === 403) return 'You do not have permission to do this.';
  if (status === 404) return 'This product no longer exists. Refresh the list.';
  if (!err?.response) return 'Network problem. Check your connection and try again.';
  return Array.isArray(msg) ? msg.join(', ') : msg || fallback;
}
