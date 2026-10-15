/**
 * Price rules - MUST mirror apps/api/src/common/pricing.ts so the POS shows the same
 * price offline that the server would pick.
 *
 *  - WHOLESALE customer            -> wholesale price
 *  - anyone buying >= wholesaleMinQty (base units) -> wholesale price
 *  - otherwise                     -> retail price
 */
export type CustomerType = 'RETAIL' | 'WHOLESALE';

export type PricedPack = {
  id: string;
  name: string;
  factor: string | number;
  retailPrice?: string | number | null;
  wholesalePrice?: string | number | null;
};

export type PricedProduct = {
  sellingPrice: string | number;
  wholesalePrice?: string | number | null;
  wholesaleMinQty?: string | number | null;
};

const num = (v: string | number | null | undefined) => (v == null ? null : Number(v));

export function isWholesaleDeal(p: PricedProduct, type: CustomerType | undefined, baseQty: number) {
  const w = num(p.wholesalePrice);
  if (w == null) return false;
  if (type === 'WHOLESALE') return true;
  const min = num(p.wholesaleMinQty);
  return min != null && baseQty >= min;
}

/** Price of ONE unit, or ONE pack when `pack` is given. `qty` is in packs when a pack is used. */
export function priceFor(
  p: PricedProduct,
  pack: PricedPack | null | undefined,
  type: CustomerType | undefined,
  qty: number,
): number {
  const factor = pack ? Number(pack.factor) : 1;
  const wholesale = isWholesaleDeal(p, type, qty * factor);
  if (!pack) return wholesale ? Number(p.wholesalePrice) : Number(p.sellingPrice);
  if (wholesale) return num(pack.wholesalePrice) ?? Number(p.wholesalePrice) * factor;
  return num(pack.retailPrice) ?? Number(p.sellingPrice) * factor;
}
