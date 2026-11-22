import { Customer, Order } from '../types';
import { isCountedOrder, orderAccountingDate } from './orderStats';

export type ProductSortBy = 'quantity' | 'revenue';
export type SortDirection = 'desc' | 'asc';

export interface ProductPerformanceRow {
  productKey: string;
  productId: string;
  productName: string;
  totalQuantity: number;
  ordersCount: number;
  revenue: number;
  sharePct: number | null;
  rank: number;
  isBestseller: boolean;
  orderIds: string[];
}

export type OrderNetAmountStatus = 'VALID' | 'MISSING' | 'INVALID';

export interface InspectedOrderNetAmount {
  status: OrderNetAmountStatus;
  /** Montant numérique fini >= 0 si valide ; sinon null. */
  amount: number | null;
}

export interface SalesNetSummary {
  totalCatalogRevenue: number;
  totalOrdersCount: number;
  /** Somme des montants nets valides enregistrés, ou null si aucune commande n'a de montant valide. */
  netRecordedTotal: number | null;
  validAmountOrdersCount: number;
  missingAmountOrdersCount: number;
  invalidAmountOrdersCount: number;
  /** Valeur catalogue correspondant uniquement aux commandes dont le montant net est valide. */
  coveredCatalogRevenue: number;
  /**
   * Écart = coveredCatalogRevenue - netRecordedTotal sur le périmètre des commandes à montant valide.
   * Positif si net < catalogue (ex. remise) ; négatif si net > catalogue (ex. frais de livraison).
   * null si aucune commande n'a de montant valide.
   */
  orderLevelGap: number | null;
}

export interface ProductPerformanceSummary {
  rows: ProductPerformanceRow[];
  totalLinesRevenue: number;
  totalOrdersRevenue: number;
  totalOrdersNetRecorded: number | null;
  validAmountOrdersCount: number;
  missingAmountOrdersCount: number;
  invalidAmountOrdersCount: number;
  coveredCatalogRevenue: number;
  totalOrderLevelGap: number | null;
  totalUnitsSold: number;
  distinctOrdersCount: number;
  hasOrderLevelAdjustment: boolean;
  hasUnallocatedDiscountOrGeste: boolean;
}

export type SalesExportMode = 'nominatif' | 'anonymise';

export interface BuildSalesCsvOptions {
  mode: SalesExportMode;
  customersById?: Map<string, Customer>;
  paymentLabels?: Record<string, string>;
}

export interface SalesCsvResult {
  csv: string;
  rowCount: number;
  orderCount: number;
  clientCount: number;
}

const DEFAULT_PAYMENT_LABELS: Record<string, string> = {
  ESPECES: 'Espèces',
  AIRTEL: 'Airtel Money',
  MTN: 'MTN MoMo',
  VIREMENT: 'Virement',
  MIXTE: 'Mixte',
  AUTRE: 'Autre',
};

const CANAL_LABELS: Record<string, string> = {
  WHATSAPP: 'WhatsApp',
  META_ADS: 'Meta Ads',
  RECOMMANDATION: 'Recommandation',
  BOUCHE_OREILLE: 'Bouche-à-oreille',
  EVENEMENT: 'Événement',
  AUTRE: 'Autre',
};

/**
 * Inspecte `order.amountPaid` sans jamais substituer `totalRetail`, sans plafonner
 * au total catalogue et sans convertir silencieusement un montant négatif ou invalide en 0.
 */
export function inspectOrderNetAmount(order: Order): InspectedOrderNetAmount {
  const raw = order.amountPaid;
  if (raw === undefined || raw === null) {
    return { status: 'MISSING', amount: null };
  }
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) {
    return { status: 'INVALID', amount: null };
  }
  return { status: 'VALID', amount: raw };
}

/**
 * Synthèse des valeurs catalogue et montants nets enregistrés sur les commandes comptabilisées.
 * - N'invente jamais un paiement lorsqu'une valeur manque (`MISSING`).
 * - Ne convertit jamais un montant négatif ou non fini en 0 (`INVALID`).
 * - Ne plafonne jamais à `totalRetail`.
 * - Calcule l'écart uniquement sur le périmètre des commandes ayant un montant net valide.
 */
export function computeSalesNetSummary(orders: Order[]): SalesNetSummary {
  const counted = orders.filter(isCountedOrder);

  let totalCatalogRevenue = 0;
  let netRecordedSum = 0;
  let validAmountOrdersCount = 0;
  let missingAmountOrdersCount = 0;
  let invalidAmountOrdersCount = 0;
  let coveredCatalogRevenue = 0;

  for (const order of counted) {
    const catalog = Number.isFinite(order.totalRetail) ? order.totalRetail : 0;
    totalCatalogRevenue += catalog;

    const inspected = inspectOrderNetAmount(order);
    if (inspected.status === 'VALID' && inspected.amount !== null) {
      validAmountOrdersCount += 1;
      netRecordedSum += inspected.amount;
      coveredCatalogRevenue += catalog;
    } else if (inspected.status === 'MISSING') {
      missingAmountOrdersCount += 1;
    } else {
      invalidAmountOrdersCount += 1;
    }
  }

  const netRecordedTotal = validAmountOrdersCount > 0 ? netRecordedSum : null;
  const orderLevelGap =
    netRecordedTotal !== null ? coveredCatalogRevenue - netRecordedTotal : null;

  return {
    totalCatalogRevenue,
    totalOrdersCount: counted.length,
    netRecordedTotal,
    validAmountOrdersCount,
    missingAmountOrdersCount,
    invalidAmountOrdersCount,
    coveredCatalogRevenue,
    orderLevelGap,
  };
}

/**
 * Neutralise les formules CSV potentiellement interprétées par Excel/Calc
 * tout en conservant les nombres négatifs numériques intacts.
 */
function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  if (typeof value === 'number') {
    const safeNum = Number.isFinite(value) ? String(value) : '0';
    return `"${safeNum}"`;
  }
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Agrège la performance produit à partir des commandes comptabilisées (VALIDATED, PAYE).
 * - Exclut automatiquement PENDING, CANCELLED, RETOUR, REMPLACEMENT, LIVRE via isCountedOrder.
 * - Ignore les quantités nulles ou négatives et les prix invalides.
 * - Compte chaque commande au plus une fois par produit (`ordersCount` via Set).
 * - Calcule la part (%) sur le total des lignes produits (`unitPrice * quantity`) sans répartir
 *   arbitrairement un éventuel écart ou geste commercial de niveau commande.
 */
export function computeProductPerformance(
  orders: Order[],
  options: { sortBy?: ProductSortBy; sortDir?: SortDirection } = {},
): ProductPerformanceSummary {
  const sortBy = options.sortBy ?? 'revenue';
  const sortDir = options.sortDir ?? 'desc';

  const counted = orders.filter(isCountedOrder);
  const netSummary = computeSalesNetSummary(counted);
  const distinctOrders = new Set<string>();
  let totalOrdersRevenue = 0;
  let hasOrderGesteOrDiscount = false;

  interface Bucket {
    productKey: string;
    productId: string;
    productName: string;
    totalQuantity: number;
    revenue: number;
    orderIdSet: Set<string>;
  }

  const buckets = new Map<string, Bucket>();

  for (const order of counted) {
    distinctOrders.add(order.id);
    if (Number.isFinite(order.totalRetail)) {
      totalOrdersRevenue += order.totalRetail;
      const inspected = inspectOrderNetAmount(order);
      if (
        (inspected.status === 'VALID' &&
          inspected.amount !== null &&
          inspected.amount !== order.totalRetail) ||
        (order.geste && order.geste !== 'AUCUN') ||
        (order.discountPercent ?? 0) > 0
      ) {
        hasOrderGesteOrDiscount = true;
      }
    }

    for (const item of order.items || []) {
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) continue;
      if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) continue;

      const productId = (item.productId || '').trim();
      const productName = (item.productName || '').trim() || productId || 'Produit sans nom';
      const productKey = productId || productName.toLocaleLowerCase('fr-FR');
      const lineRevenue = item.unitPrice * item.quantity;

      const existing = buckets.get(productKey);
      if (existing) {
        existing.totalQuantity += item.quantity;
        existing.revenue += lineRevenue;
        existing.orderIdSet.add(order.id);
        if (!existing.productName && productName) {
          existing.productName = productName;
        }
      } else {
        buckets.set(productKey, {
          productKey,
          productId: productId || productKey,
          productName,
          totalQuantity: item.quantity,
          revenue: lineRevenue,
          orderIdSet: new Set([order.id]),
        });
      }
    }
  }

  let totalLinesRevenue = 0;
  let totalUnitsSold = 0;
  for (const bucket of buckets.values()) {
    totalLinesRevenue += bucket.revenue;
    totalUnitsSold += bucket.totalQuantity;
  }

  const rawRows = Array.from(buckets.values()).map((bucket) => ({
    productKey: bucket.productKey,
    productId: bucket.productId,
    productName: bucket.productName,
    totalQuantity: bucket.totalQuantity,
    ordersCount: bucket.orderIdSet.size,
    revenue: bucket.revenue,
    sharePct: totalLinesRevenue > 0 ? (bucket.revenue / totalLinesRevenue) * 100 : null,
    orderIds: Array.from(bucket.orderIdSet),
  }));

  // Rang canonique décroissant selon le critère actif et identification du best-seller par CA puis quantité
  const descCompare = (
    a: Omit<ProductPerformanceRow, 'rank' | 'isBestseller'>,
    b: Omit<ProductPerformanceRow, 'rank' | 'isBestseller'>,
    criterion: ProductSortBy,
  ): number => {
    const primary = criterion === 'quantity' ? b.totalQuantity - a.totalQuantity : b.revenue - a.revenue;
    if (primary !== 0) return primary;
    const secondary = criterion === 'quantity' ? b.revenue - a.revenue : b.totalQuantity - a.totalQuantity;
    if (secondary !== 0) return secondary;
    return a.productName.localeCompare(b.productName, 'fr-FR');
  };

  const bestByRevenue = [...rawRows].sort((a, b) => descCompare(a, b, 'revenue'))[0];
  const bestsellerKey =
    bestByRevenue && (bestByRevenue.revenue > 0 || bestByRevenue.totalQuantity > 0)
      ? bestByRevenue.productKey
      : null;

  const rankedDesc = [...rawRows].sort((a, b) => descCompare(a, b, sortBy));
  const rankMap = new Map<string, number>();
  rankedDesc.forEach((row, index) => {
    rankMap.set(row.productKey, index + 1);
  });

  const sortedRows = [...rawRows]
    .sort((a, b) => {
      const cmp = descCompare(a, b, sortBy);
      return sortDir === 'asc' ? -cmp : cmp;
    })
    .map((row) => ({
      ...row,
      rank: rankMap.get(row.productKey) ?? 1,
      isBestseller: bestsellerKey !== null && row.productKey === bestsellerKey,
    }));

  const hasOrderLevelAdjustment =
    counted.length > 0 && Math.abs(Math.round(totalLinesRevenue) - Math.round(totalOrdersRevenue)) > 1;

  return {
    rows: sortedRows,
    totalLinesRevenue,
    totalOrdersRevenue,
    totalOrdersNetRecorded: netSummary.netRecordedTotal,
    validAmountOrdersCount: netSummary.validAmountOrdersCount,
    missingAmountOrdersCount: netSummary.missingAmountOrdersCount,
    invalidAmountOrdersCount: netSummary.invalidAmountOrdersCount,
    coveredCatalogRevenue: netSummary.coveredCatalogRevenue,
    totalOrderLevelGap: netSummary.orderLevelGap,
    totalUnitsSold,
    distinctOrdersCount: distinctOrders.size,
    hasOrderLevelAdjustment,
    hasUnallocatedDiscountOrGeste: hasOrderLevelAdjustment || hasOrderGesteOrDiscount,
  };
}

/**
 * Construit un export CSV complet des ventes comptabilisées (séparateur `;`, UTF-8 BOM pour Excel).
 * - Mode `nominatif` : inclut identité client et coordonnées disponibles.
 * - Mode `anonymise` : supprime strictement toute PII (nom, téléphone, email, adresse, ville,
 *   référence paiement, notes, ID brut client) et attribue un alias déterministe `Client #001`.
 */
export function buildSalesCsvExport(
  orders: Order[],
  options: BuildSalesCsvOptions,
): SalesCsvResult {
  const { mode, customersById, paymentLabels = DEFAULT_PAYMENT_LABELS } = options;

  const counted = orders
    .filter(isCountedOrder)
    .slice()
    .sort((a, b) => {
      const dateCmp = orderAccountingDate(b).localeCompare(orderAccountingDate(a));
      if (dateCmp !== 0) return dateCmp;
      return (b.refCommande || b.id).localeCompare(a.refCommande || a.id);
    });

  // Table d'anonymisation cohérente pour la session d'export
  const anonLabels = new Map<string, string>();
  let anonCounter = 0;
  const getAnonLabel = (order: Order): string => {
    const identityKey =
      (order.customerId || '').trim() ||
      (order.customerName || '').trim().toLocaleLowerCase('fr-FR') ||
      order.id;
    const existing = anonLabels.get(identityKey);
    if (existing) return existing;
    anonCounter += 1;
    const label = `Client #${String(anonCounter).padStart(3, '0')}`;
    anonLabels.set(identityKey, label);
    return label;
  };

  const headers =
    mode === 'nominatif'
      ? [
          'Date',
          'Référence commande',
          'Statut',
          'Type',
          'Canal',
          'Mode de paiement',
          'Réf. paiement',
          'Client',
          'Téléphone',
          'E-mail',
          'Ville',
          'Produit',
          'Quantité',
          'Prix unitaire (FCFA)',
          'Total ligne (FCFA)',
          'Total catalogue commande (FCFA)',
          'Montant net enregistré (FCFA)',
          'Marge commande (FCFA)',
          'Geste commercial',
          'Notes',
        ]
      : [
          'Date',
          'Référence commande',
          'Statut',
          'Type',
          'Canal',
          'Mode de paiement',
          'Identifiant anonyme',
          'Produit',
          'Quantité',
          'Prix unitaire (FCFA)',
          'Total ligne (FCFA)',
          'Total catalogue commande (FCFA)',
          'Montant net enregistré (FCFA)',
          'Marge commande (FCFA)',
          'Geste commercial',
        ];

  const rows: unknown[][] = [headers];
  let detailRowsCount = 0;

  for (const order of counted) {
    const anonClient = getAnonLabel(order);
    const date = orderAccountingDate(order);
    const ref = order.refCommande || order.id;
    const statusLabel = order.status === 'PAYE' ? 'Payée' : 'Validée';
    const payment = paymentLabels[order.paiement] || order.paiement || 'Autre';
    const canal = CANAL_LABELS[order.canal] || order.canal || 'Autre';
    const inspectedNet = inspectOrderNetAmount(order);
    const netRecordedCell: number | string =
      inspectedNet.status === 'VALID' && inspectedNet.amount !== null
        ? Math.round(inspectedNet.amount)
        : inspectedNet.status === 'MISSING'
          ? 'Non renseigné'
          : 'Invalide';
    const customer = customersById?.get(order.customerId);

    const validItems = (order.items || []).filter(
      (item) => Number.isFinite(item.quantity) && item.quantity > 0,
    );
    const itemsToExport = validItems.length > 0 ? validItems : [null];

    for (const item of itemsToExport) {
      detailRowsCount += 1;
      const productName = item ? item.productName : '—';
      const quantity = item ? item.quantity : 0;
      const unitPrice = item ? Math.round(item.unitPrice) : 0;
      const lineTotal = item ? Math.round(item.unitPrice * item.quantity) : 0;

      if (mode === 'nominatif') {
        rows.push([
          date,
          ref,
          statusLabel,
          order.type,
          canal,
          payment,
          order.refPaiement || '',
          order.customerName,
          customer?.phone || '',
          customer?.email || '',
          customer?.ville || '',
          productName,
          quantity,
          unitPrice,
          lineTotal,
          Math.round(order.totalRetail),
          netRecordedCell,
          Math.round(order.totalMargin),
          order.geste || 'AUCUN',
          order.notes || '',
        ]);
      } else {
        rows.push([
          date,
          ref,
          statusLabel,
          order.type,
          canal,
          payment,
          anonClient,
          productName,
          quantity,
          unitPrice,
          lineTotal,
          Math.round(order.totalRetail),
          netRecordedCell,
          Math.round(order.totalMargin),
          order.geste || 'AUCUN',
        ]);
      }
    }
  }

  const csv = rows.map((row) => row.map(sanitizeCsvCell).join(';')).join('\n');

  return {
    csv,
    rowCount: detailRowsCount,
    orderCount: counted.length,
    clientCount: anonLabels.size,
  };
}
