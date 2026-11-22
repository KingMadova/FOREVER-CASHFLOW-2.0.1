import {
  CustomerPriceType,
  GradeCode,
  LivraisonMode,
  Order,
  OrderCanal,
  OrderGeste,
  OrderItem,
  OrderPaiement,
  OrderType,
} from '../types';

export const PV_PER_CC = 135; // 1 CC = 135 PV (ratio FLP standard)

export function calculateLivraisonFrais(totalRetail: number, mode: LivraisonMode): number {
  if (totalRetail >= 15000) return 0; // Livraison offerte ≥ 15k
  switch (mode) {
    case 'DOMICILE':
      return 5000;
    case 'POINT_RELAIS':
      return 3000;
    case 'MAIN_PROPRE':
      return 0;
    case 'RETRAIT_BOUTIQUE':
      return 0;
    default:
      return 0;
  }
}

export function applyGeste(order: Partial<Order>): Partial<Order> {
  const updated = { ...order };
  switch (updated.geste) {
    case 'CLEAN9_-7K':
      updated.gesteMontant = 7166;
      updated.livraison = {
        mode: updated.livraison?.mode ?? 'DOMICILE',
        datePrevue: updated.livraison?.datePrevue ?? new Date().toISOString().split('T')[0],
        ...updated.livraison,
        frais: 0,
      };
      break;
    case 'LIVRAISON_GRATUITE':
      updated.livraison = {
        mode: updated.livraison?.mode ?? 'DOMICILE',
        datePrevue: updated.livraison?.datePrevue ?? new Date().toISOString().split('T')[0],
        ...updated.livraison,
        frais: 0,
      };
      break;
    case 'FIELDS_OFFERT':
      updated.gesteMontant = 10285; // Prix retail Fields of Greens
      break;
    case 'REMISE_5':
      updated.discountPercent = 5;
      break;
  }
  return updated;
}

/**
 * Crée une commande à partir du panier avec les tarifs officiels figés par ligne.
 * Le coût d'achat officiel (`unitCost`) et la catégorie client (`customerPriceType`)
 * sont snapshots au moment de la création et ne seront jamais recalculés suite à un changement de grade.
 */
export function createOrderFromCart(params: {
  customerId: string;
  customerName: string;
  items: OrderItem[];
  type: OrderType;
  canal: OrderCanal;
  paiement: OrderPaiement;
  geste: OrderGeste;
  livraisonMode: LivraisonMode;
  datePrevueLivraison: string;
  distributeurId?: string;
  tags?: string[];
  notes?: string;
  catalogTotal: number;
  amountPaid?: number;
  profileGrade: GradeCode;
  customerPriceType: CustomerPriceType;
}): Omit<Order, 'id'> {
  if (params.items.some((item) => item.unitCost == null || !Number.isFinite(item.unitCost))) {
    throw new Error('Impossible de créer la commande : coût d’achat officiel manquant pour un produit.');
  }

  const catalogRetail = params.catalogTotal;
  const paid = params.amountPaid ?? catalogRetail;
  const discountPercent =
    catalogRetail > 0 ? Math.round(((catalogRetail - paid) / catalogRetail) * 100) : 0;

  const totalCost = params.items.reduce((sum, item) => sum + item.unitCost! * item.quantity, 0);

  const livraisonFraisCalc = calculateLivraisonFrais(catalogRetail, params.livraisonMode);
  const gesteMontantCalc =
    params.geste === 'CLEAN9_-7K'
      ? 7166
      : params.geste === 'FIELDS_OFFERT'
        ? 10285
        : params.geste === 'REMISE_5'
          ? Math.max(0, Math.round(catalogRetail * 0.05))
          : 0;
  const realMargin = paid - totalCost - livraisonFraisCalc - gesteMontantCalc;

  const totalRetail = catalogRetail;
  const totalCC = params.items.reduce((sum, i) => sum + i.unitCC * i.quantity, 0);
  const totalPV = Math.round(totalCC * PV_PER_CC);
  const totalBV = totalCC;

  const livraisonFrais = calculateLivraisonFrais(totalRetail, params.livraisonMode);

  const baseOrder: Omit<Order, 'id'> = {
    customerId: params.customerId,
    customerName: params.customerName,
    date: new Date().toISOString().split('T')[0],
    items: params.items,
    status: 'PENDING',
    totalRetail,
    totalCost,
    totalMargin: realMargin,
    amountPaid: paid,
    totalCC,
    totalPV,
    totalBV,
    discountPercent: discountPercent > 0 ? discountPercent : undefined,
    customerPriceType: params.customerPriceType,
    partnerGrade: params.profileGrade,
    type: params.type,
    canal: params.canal,
    paiement: params.paiement,
    geste: params.geste,
    refPaiement: undefined,
    encaissementDate: undefined,
    refCommande: '',
    gesteMontant: undefined,
    livraison: {
      mode: params.livraisonMode,
      frais: livraisonFrais,
      datePrevue: params.datePrevueLivraison,
      dateReelle: undefined,
      transporteur: undefined,
      adresseLivraison: undefined,
    },
    delaiLivraison: undefined,
    satisfaction: undefined,
    satisfactionNote: undefined,
    satisfactionDate: undefined,
    recommandation: false,
    recommandationClientId: undefined,
    distributeurId: params.distributeurId || '',
    tags: params.tags || [],
    notes: params.notes,
  };

  return applyGeste(baseOrder) as Omit<Order, 'id'>;
}

/**
 * Répartit de manière déterministe (méthode des plus forts restes / Hamilton)
 * le coût historique restant sur les anciennes lignes dépourvues de `unitCost`,
 * afin que la somme des coûts historiques attribués égale exactement `existing.totalCost`
 * sans aucune dérive d'arrondi et sans contamination par de nouvelles lignes.
 */
export function allocateLegacyLineCosts(existing: Order): Map<string, number> {
  const allocated = new Map<string, number>();
  const oldItems = existing.items || [];
  if (oldItems.length === 0) return allocated;

  let knownCostSum = 0;
  const legacyEntries: { index: number; item: OrderItem; weight: number }[] = [];

  oldItems.forEach((item, index) => {
    if (item.unitCost != null && Number.isFinite(item.unitCost)) {
      knownCostSum += item.unitCost * item.quantity;
    } else {
      legacyEntries.push({
        index,
        item,
        weight: Math.max(0, item.unitPrice * item.quantity),
      });
    }
  });

  if (legacyEntries.length === 0) return allocated;
  if (existing.totalCost == null || !Number.isFinite(existing.totalCost)) {
    return allocated;
  }

  const remainingLegacyCost = Math.max(0, Math.round(existing.totalCost - knownCostSum));
  const totalWeight = legacyEntries.reduce((sum, entry) => sum + entry.weight, 0);

  const quotas = legacyEntries.map((entry) => {
    const exact =
      totalWeight > 0
        ? (remainingLegacyCost * entry.weight) / totalWeight
        : remainingLegacyCost / legacyEntries.length;
    const floored = Math.floor(exact);
    return {
      index: entry.index,
      productId: entry.item.productId,
      floored,
      remainder: exact - floored,
    };
  });

  const flooredSum = quotas.reduce((sum, q) => sum + q.floored, 0);
  let reliquat = remainingLegacyCost - flooredSum;

  // Tri déterministe : plus fort reste décroissant, puis ordre d'apparition croissant
  const ranked = [...quotas].sort((a, b) => {
    const diff = b.remainder - a.remainder;
    if (Math.abs(diff) > 1e-12) return diff;
    return a.index - b.index;
  });

  const finalAmounts = new Map<number, number>();
  for (const q of quotas) {
    finalAmounts.set(q.index, q.floored);
  }
  for (let i = 0; i < ranked.length && reliquat > 0; i++) {
    const target = ranked[i];
    finalAmounts.set(target.index, (finalAmounts.get(target.index) ?? 0) + 1);
    reliquat -= 1;
  }

  for (const q of quotas) {
    allocated.set(q.productId, finalAmounts.get(q.index) ?? q.floored);
  }

  return allocated;
}

/**
 * Retourne le coût unitaire historique d'une ancienne ligne :
 * - si `unitCost` est déjà présent, il est retourné tel quel sans jamais être modifié ;
 * - sinon (commande héritée), retourne le coût unitaire dérivé de l'allocation exacte
 *   `allocateLegacyLineCosts(existing)` divisée par la quantité d'origine.
 */
export function resolveLegacyFrozenUnitCost(existing: Order, oldItem: OrderItem): number | undefined {
  if (oldItem.unitCost != null && Number.isFinite(oldItem.unitCost)) {
    return oldItem.unitCost;
  }
  const allocated = allocateLegacyLineCosts(existing);
  const lineCost = allocated.get(oldItem.productId);
  if (lineCost === undefined) return undefined;
  const oldQty = oldItem.quantity > 0 ? oldItem.quantity : 1;
  return lineCost / oldQty;
}

/**
 * Construit les lignes d'une commande lors de son édition :
 * - Toute ligne déjà présente dans la commande d'origine conserve strictement
 *   son `unitPrice`, son `unitCost`, sa `priceCategory`, son `unitCC` et son `unitPV` d'origine.
 * - Toute nouvelle ligne ajoutée pendant l'édition reçoit les tarifs applicables
 *   au moment de son ajout (`currentPartnerGrade` et `currentCustomerPriceType`).
 */
export function buildOrderItemsForEdit(params: {
  existing: Order;
  cartItems: { product: { id: string; name: string; unitCC: number; unitPV?: number; prixRetail: number; prices?: any }; quantity: number }[];
  currentPartnerGrade: GradeCode;
  currentCustomerPriceType: CustomerPriceType;
  applyDiscount: boolean;
  getSalePrice: (product: any, customerType: CustomerPriceType) => number | null;
  getPurchasePrice: (product: any, grade: GradeCode) => number | null;
}): OrderItem[] {
  const existingItemByProduct = new Map<string, OrderItem>();
  for (const oldItem of params.existing.items || []) {
    if (!existingItemByProduct.has(oldItem.productId)) {
      existingItemByProduct.set(oldItem.productId, oldItem);
    }
  }
  const legacyAllocations = allocateLegacyLineCosts(params.existing);

  return params.cartItems.map((slot) => {
    const frozen = existingItemByProduct.get(slot.product.id);
    if (frozen) {
      let frozenUnitCost = frozen.unitCost;
      if (frozenUnitCost == null || !Number.isFinite(frozenUnitCost)) {
        const lineCost = legacyAllocations.get(frozen.productId);
        if (lineCost !== undefined) {
          const oldQty = frozen.quantity > 0 ? frozen.quantity : 1;
          frozenUnitCost = lineCost / oldQty;
        }
      }
      return {
        ...frozen,
        quantity: slot.quantity,
        unitCost: frozenUnitCost,
        isDiscounted: params.applyDiscount,
      };
    }

    const salePrice = params.getSalePrice(slot.product, params.currentCustomerPriceType);
    const purchaseCost = params.getPurchasePrice(slot.product, params.currentPartnerGrade);
    if (salePrice == null || purchaseCost == null) {
      throw new Error(
        'Un tarif officiel est indisponible pour un produit ajouté et votre grade actuel.'
      );
    }

    return {
      productId: slot.product.id,
      productName: slot.product.name,
      quantity: slot.quantity,
      unitPrice: salePrice,
      unitCost: purchaseCost,
      priceCategory: params.currentCustomerPriceType,
      unitCC: slot.product.unitCC,
      unitPV: slot.product.unitPV,
      isDiscounted: params.applyDiscount,
    };
  });
}

/**
 * Met à jour une commande existante en préservant strictement ses snapshots historiques :
 * - date d'origine, refCommande, partnerGrade, customerPriceType, createdAt, validatedAt
 * - unitPrice / unitCost / priceCategory des lignes déjà enregistrées (jamais recalculés si le grade partenaire change)
 * - les lignes ajoutées utilisent leur propre `unitPrice`/`unitCost` fourni au moment de l'ajout
 */
export function buildEditedOrderPayload(params: {
  existing: Order;
  customerId: string;
  customerName: string;
  items: OrderItem[];
  type: OrderType;
  canal: OrderCanal;
  paiement: OrderPaiement;
  geste: OrderGeste;
  livraisonMode: LivraisonMode;
  datePrevueLivraison: string;
  notes?: string;
  amountPaid?: number;
}): Order {
  const { existing } = params;
  const existingItemByProduct = new Map<string, OrderItem>();
  for (const oldItem of existing.items || []) {
    if (!existingItemByProduct.has(oldItem.productId)) {
      existingItemByProduct.set(oldItem.productId, oldItem);
    }
  }
  const legacyAllocations = allocateLegacyLineCosts(existing);

  // Conserver les tarifs figés des lignes historiques déjà présentes dans la commande
  const frozenItems: OrderItem[] = params.items.map((item) => {
    const old = existingItemByProduct.get(item.productId);
    if (old) {
      let resolvedOldCost = old.unitCost;
      if (resolvedOldCost == null || !Number.isFinite(resolvedOldCost)) {
        const lineCost = legacyAllocations.get(old.productId);
        if (lineCost !== undefined) {
          const oldQty = old.quantity > 0 ? old.quantity : 1;
          resolvedOldCost = lineCost / oldQty;
        }
      }
      return {
        ...item,
        productName: old.productName || item.productName,
        unitPrice: old.unitPrice,
        unitCost: resolvedOldCost !== undefined ? resolvedOldCost : item.unitCost,
        priceCategory: old.priceCategory ?? item.priceCategory,
        unitCC: old.unitCC ?? item.unitCC,
        unitPV: old.unitPV ?? item.unitPV,
      };
    }
    return item;
  });

  if (frozenItems.some((item) => item.unitCost == null || !Number.isFinite(item.unitCost))) {
    if (existing.totalCost == null || !Number.isFinite(existing.totalCost)) {
      throw new Error('Impossible de modifier la commande : coût d’achat officiel manquant pour un produit.');
    }
  }

  const totalRetail = frozenItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const paid = params.amountPaid ?? totalRetail;
  const discountPercent =
    totalRetail > 0 ? Math.round(((totalRetail - paid) / totalRetail) * 100) : 0;

  const allItemsHaveUnitCost = frozenItems.every(
    (item) => item.unitCost != null && Number.isFinite(item.unitCost)
  );
  // Sépare strictement la somme exacte des anciennes lignes et celle des nouvelles lignes,
  // puis arrondit au FCFA le plus proche pour éliminer tout epsilon IEEE-754 (ex: (20000/3)*3).
  const totalCost = allItemsHaveUnitCost
    ? Math.round(
        frozenItems.reduce((sum, item) => sum + item.unitCost! * item.quantity, 0)
      )
    : existing.totalCost;

  const livraisonFrais = calculateLivraisonFrais(totalRetail, params.livraisonMode);
  const gesteMontantCalc =
    params.geste === 'CLEAN9_-7K'
      ? 7166
      : params.geste === 'FIELDS_OFFERT'
        ? 10285
        : params.geste === 'REMISE_5'
          ? Math.max(0, Math.round(totalRetail * 0.05))
          : 0;
  const totalMargin = paid - totalCost - livraisonFrais - gesteMontantCalc;

  const totalCC = frozenItems.reduce((sum, i) => sum + i.unitCC * i.quantity, 0);
  const totalPV = Math.round(totalCC * PV_PER_CC);
  const totalBV = totalCC;

  const updated: Order = {
    ...existing,
    customerId: params.customerId,
    customerName: params.customerName,
    items: frozenItems,
    totalRetail,
    totalCost,
    totalMargin,
    amountPaid: paid,
    totalCC,
    totalPV,
    totalBV,
    discountPercent: discountPercent > 0 ? discountPercent : undefined,
    customerPriceType: existing.customerPriceType,
    partnerGrade: existing.partnerGrade,
    type: params.type,
    canal: params.canal,
    paiement: params.paiement,
    geste: params.geste,
    gesteMontant: undefined,
    notes: params.notes,
    livraison: {
      ...existing.livraison,
      mode: params.livraisonMode,
      frais: livraisonFrais,
      datePrevue: params.datePrevueLivraison,
    },
  };

  return applyGeste(updated) as Order;
}
