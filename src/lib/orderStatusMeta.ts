// src/lib/orderStatusMeta.ts
// Source unique de libellés et de tons pour les statuts de commande.
// Ne contient AUCUNE classe CSS : chaque consommateur (StatusBadge,
// Dashboard activities, exports) choisit son rendu à partir du tone.

import type { OrderStatut } from '../types';

export type OrderStatusTone =
  | 'neutral'   // slate
  | 'info'      // blue / sky
  | 'success'   // emerald
  | 'warning'   // amber
  | 'danger'    // red
  | 'violet';   // violet / purple

export interface OrderStatusMeta {
  /** Libellé français affiché dans l'UI et les exports. */
  readonly label: string;
  /** Ton sémantique utilisé par les badges, cartes, activités. */
  readonly tone: OrderStatusTone;
  /** Libellé court pour tableaux compacts. */
  readonly shortLabel: string;
}

export const ORDER_STATUS_META: Readonly<Record<OrderStatut, OrderStatusMeta>> = {
  PENDING:      { label: 'En attente',   shortLabel: 'Attente',  tone: 'warning' },
  VALIDATED:    { label: 'Validée',      shortLabel: 'Validée',  tone: 'success' },
  PAYE:         { label: 'Payée',        shortLabel: 'Payée',    tone: 'success' },
  LIVRE:        { label: 'Livrée',       shortLabel: 'Livrée',   tone: 'info'    },
  CANCELLED:    { label: 'Annulée',      shortLabel: 'Annulée',  tone: 'neutral' },
  RETOUR:       { label: 'Retour',       shortLabel: 'Retour',   tone: 'danger'  },
  REMPLACEMENT: { label: 'Remplacement', shortLabel: 'Rempl.',   tone: 'violet'  },
} as const;

/** Retourne les métadonnées du statut, ou celles de PENDING par défaut. */
export function getOrderStatusMeta(status: OrderStatut | undefined | null): OrderStatusMeta {
  if (!status) return ORDER_STATUS_META.PENDING;
  return ORDER_STATUS_META[status] ?? ORDER_STATUS_META.PENDING;
}

/** Retourne le libellé français d'un statut, fallback sur la valeur brute. */
export function orderStatusLabel(status: OrderStatut | undefined | null): string {
  if (!status) return '—';
  return ORDER_STATUS_META[status]?.label ?? String(status);
}