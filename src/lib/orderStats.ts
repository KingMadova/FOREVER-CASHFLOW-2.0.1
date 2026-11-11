// orderStats.ts — SOURCE UNIQUE pour "quelles commandes comptent" et "à quelle date".
// Règle FLP : une vente compte dans le mois où elle est VALIDÉE (pas créée).
import { Order } from '../types';

// Statuts qui génèrent une marge (alignés sur ordersSlice : budget auto pour VALIDATED et PAYE)
export const COUNTED_STATUSES: string[] = ['VALIDATED', 'PAYE'];

export const isCountedStatus = (status: string): boolean => COUNTED_STATUSES.includes(status);
export const isCountedOrder = (o: Order): boolean => isCountedStatus(o.status);

// Date locale YYYY-MM-DD (évite le décalage UTC de toISOString)
export const localDateISO = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Date comptable : validation pour les ventes comptées, création sinon
export const orderAccountingDate = (o: Order): string =>
  ((isCountedOrder(o) ? (o.validatedAt || o.date) : o.date) || '').split('T')[0];

// Comparaison sur le texte YYYY-MM : insensible aux fuseaux horaires
export const isInMonth = (dateStr: string, year: number, month1to12: number): boolean =>
  dateStr.startsWith(`${year}-${String(month1to12).padStart(2, '0')}`);
export const isInYear = (dateStr: string, year: number): boolean =>
  dateStr.startsWith(`${year}-`);

export const countedOrdersInMonth = (orders: Order[], year: number, month1to12: number): Order[] =>
  orders.filter(o => isCountedOrder(o) && isInMonth(orderAccountingDate(o), year, month1to12));
export const countedOrdersInYear = (orders: Order[], year: number): Order[] =>
  orders.filter(o => isCountedOrder(o) && isInYear(orderAccountingDate(o), year));

export const sumOrders = (list: Order[]) => ({
  retail: list.reduce((s, o) => s + o.totalRetail, 0),
  cost:   list.reduce((s, o) => s + o.totalCost, 0),
  margin: list.reduce((s, o) => s + o.totalMargin, 0),
  cc:     list.reduce((s, o) => s + o.totalCC, 0),
  count:  list.length,
});
