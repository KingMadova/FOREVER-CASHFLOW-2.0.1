// sortHelper.ts — tri partagé (commandes, clients, trésorerie, rapports)
import { useState, useCallback } from 'react';
import { Order, OrderStatus, BudgetEntry } from '../types';

export interface SortOption { key: string; label: string; }

// ── Utilitaires ─────────────────────────────────────────────
export const cmpText = (a: string = '', b: string = ''): number =>
  a.localeCompare(b, 'fr', { sensitivity: 'base' });
export const cmpNum = (a: number = 0, b: number = 0): number => a - b;
export const cmpDate = (a: string = '', b: string = ''): number => (a < b ? -1 : a > b ? 1 : 0);

export function sortList<T>(
  list: T[],
  key: string,
  comparators: Record<string, (a: T, b: T) => number>
): T[] {
  const cmp = comparators[key];
  return cmp ? [...list].sort(cmp) : [...list];
}

// Mémorise le dernier tri choisi, par vue
export const useSortPref = (storageKey: string, options: SortOption[], defaultKey: string) => {
  const [sortKey, setSortKeyState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved && options.some(o => o.key === saved)) return saved;
    } catch { /* ignore */ }
    return defaultKey;
  });
  const setSortKey = useCallback((k: string) => {
    setSortKeyState(k);
    try { localStorage.setItem(storageKey, k); } catch { /* ignore */ }
  }, [storageKey]);
  return [sortKey, setSortKey] as const;
};

// ── Commandes ───────────────────────────────────────────────
export const ORDER_SORT_OPTIONS: SortOption[] = [
  { key: 'date_desc',   label: 'Date · récent d’abord' },
  { key: 'date_asc',    label: 'Date · ancien d’abord' },
  { key: 'name_asc',    label: 'Client · A → Z' },
  { key: 'name_desc',   label: 'Client · Z → A' },
  { key: 'amount_desc', label: 'Montant · décroissant' },
  { key: 'amount_asc',  label: 'Montant · croissant' },
  { key: 'cc_desc',     label: 'CC · décroissant' },
  { key: 'status',      label: 'Statut' },
];

// Même date que celle affichée sur les cartes : validation si validée, sinon création
const orderDate = (o: Order): string =>
  o.status === OrderStatus.VALIDATED ? (o.validatedAt || o.date) : o.date;

const STATUS_RANK: Record<string, number> = {
  PENDING: 0, VALIDATED: 1, PAYE: 2, LIVRE: 3, REMPLACEMENT: 4, RETOUR: 5, CANCELLED: 6,
};

const byDateDesc = (a: Order, b: Order) => cmpDate(orderDate(b), orderDate(a));

export const orderComparators: Record<string, (a: Order, b: Order) => number> = {
  date_desc:   byDateDesc,
  date_asc:    (a, b) => cmpDate(orderDate(a), orderDate(b)),
  name_asc:    (a, b) => cmpText(a.customerName, b.customerName) || byDateDesc(a, b),
  name_desc:   (a, b) => cmpText(b.customerName, a.customerName) || byDateDesc(a, b),
  amount_desc: (a, b) => cmpNum(b.totalRetail, a.totalRetail) || byDateDesc(a, b),
  amount_asc:  (a, b) => cmpNum(a.totalRetail, b.totalRetail) || byDateDesc(a, b),
  cc_desc:     (a, b) => cmpNum(b.totalCC, a.totalCC) || byDateDesc(a, b),
  status:      (a, b) => cmpNum(STATUS_RANK[a.status] ?? 9, STATUS_RANK[b.status] ?? 9) || byDateDesc(a, b),
};

// ── Trésorerie ──────────────────────────────────────────────
export const BUDGET_SORT_OPTIONS: SortOption[] = [
  { key: 'date_desc',   label: 'Date · récent d’abord' },
  { key: 'date_asc',    label: 'Date · ancien d’abord' },
  { key: 'amount_desc', label: 'Montant · décroissant' },
  { key: 'amount_asc',  label: 'Montant · croissant' },
  { key: 'category_asc', label: 'Catégorie · A → Z' },
  { key: 'label_asc',   label: 'Libellé · A → Z' },
  { key: 'type_in',     label: 'Entrées d’abord' },
  { key: 'type_out',    label: 'Sorties d’abord' },
];

const bDateDesc = (a: BudgetEntry, b: BudgetEntry) => cmpDate(b.date, a.date);

export const budgetComparators: Record<string, (a: BudgetEntry, b: BudgetEntry) => number> = {
  date_desc:    bDateDesc,
  date_asc:     (a, b) => cmpDate(a.date, b.date),
  amount_desc:  (a, b) => cmpNum(b.amount, a.amount) || bDateDesc(a, b),
  amount_asc:   (a, b) => cmpNum(a.amount, b.amount) || bDateDesc(a, b),
  category_asc: (a, b) => cmpText(a.category, b.category) || bDateDesc(a, b),
  label_asc:    (a, b) => cmpText(a.description, b.description) || bDateDesc(a, b),
  type_in:      (a, b) => cmpNum(a.type === 'REVENUE' ? 0 : 1, b.type === 'REVENUE' ? 0 : 1) || bDateDesc(a, b),
  type_out:     (a, b) => cmpNum(a.type === 'EXPENSE' ? 0 : 1, b.type === 'EXPENSE' ? 0 : 1) || bDateDesc(a, b),
};

// ── Clients ─────────────────────────────────────────────────
export const CLIENT_SORT_OPTIONS: SortOption[] = [
  { key: 'name_asc',     label: 'Nom · A → Z' },
  { key: 'name_desc',    label: 'Nom · Z → A' },
  { key: 'month_desc',   label: 'CA du mois · décroissant' },
  { key: 'total_desc',   label: 'CA total · décroissant' },
  { key: 'last_desc',    label: 'Dernière commande · récente' },
  { key: 'last_asc',     label: 'Dernière commande · ancienne' },
  { key: 'created_desc', label: 'Ajout · récent d’abord' },
  { key: 'created_asc',  label: 'Ajout · ancien d’abord' },
];
