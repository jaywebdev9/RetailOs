import { Prisma } from '@prisma/client';

type PricedProduct = {
  sellingPrice: Prisma.Decimal;
  wholesalePrice: Prisma.Decimal | null;
  wholesaleMinQty: Prisma.Decimal | null;
};

type PricedPack = {
  factor: Prisma.Decimal;
  retailPrice: Prisma.Decimal | null;
  wholesalePrice: Prisma.Decimal | null;
};

/**
 * Wholesale rule (same rule is mirrored in the POS for offline use):
 *  - WHOLESALE customer            → wholesale price
 *  - any customer buying >= minQty → wholesale price (quantity break)
 *  - otherwise                     → retail price
 */
export function isWholesaleDeal(
  product: PricedProduct,
  customerType: 'RETAIL' | 'WHOLESALE' | undefined,
  baseQty: Prisma.Decimal,
): boolean {
  if (!product.wholesalePrice) return false;
  if (customerType === 'WHOLESALE') return true;
  return !!product.wholesaleMinQty && baseQty.gte(product.wholesaleMinQty);
}

/** Price for ONE BASE UNIT. */
export function resolveUnitPrice(
  product: PricedProduct,
  customerType: 'RETAIL' | 'WHOLESALE' | undefined,
  baseQty: Prisma.Decimal,
): Prisma.Decimal {
  return isWholesaleDeal(product, customerType, baseQty)
    ? product.wholesalePrice!
    : product.sellingPrice;
}

/** Price for ONE PACK (carton, sack...). Falls back to base price × factor. */
export function resolvePackPrice(
  product: PricedProduct,
  pack: PricedPack,
  customerType: 'RETAIL' | 'WHOLESALE' | undefined,
  baseQty: Prisma.Decimal,
): Prisma.Decimal {
  if (isWholesaleDeal(product, customerType, baseQty)) {
    return pack.wholesalePrice ?? product.wholesalePrice!.mul(pack.factor);
  }
  return pack.retailPrice ?? product.sellingPrice.mul(pack.factor);
}
