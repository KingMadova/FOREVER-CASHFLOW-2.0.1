import type { CustomerPriceType, GradeCode, Product, ProductPriceTable } from '../types';
import { OFFICIAL_PRICE_LIST } from '../data/officialPriceList';

export function getOfficialProductPrices(product: Product): ProductPriceTable | undefined {
  return OFFICIAL_PRICE_LIST[product.id] ?? product.prices;
}

export function getCustomerSalePrice(
  product: Product,
  customerType: CustomerPriceType
): number | null {
  const prices = getOfficialProductPrices(product);
  if (prices) return prices[customerType];
  // Compatibilité avec les produits personnalisés/anciens : seul le prix public
  // peut être utilisé. Aucun prix CP n'est inventé.
  return customerType === 'PUBLIC' && Number.isFinite(product.prixRetail)
    ? product.prixRetail
    : null;
}

export function getPartnerPurchasePrice(
  product: Product,
  grade: GradeCode
): number | null {
  const prices = getOfficialProductPrices(product);
  if (!prices) return null;
  const gradeKey = grade === 'M' ? 'MGR' : grade;
  return prices[gradeKey];
}

export function withOfficialProductPrices(product: Product): Product {
  const prices = OFFICIAL_PRICE_LIST[product.id];
  return prices
    ? { ...product, prices, prixRetail: prices.PUBLIC ?? product.prixRetail }
    : product;
}
