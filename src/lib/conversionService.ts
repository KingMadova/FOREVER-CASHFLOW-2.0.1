import { Order, Customer } from '../types';

/**
 * #3 Détection de réachat et taux de conversion.
 * Un achat est "converti" si le même client valide une commande ultérieure.
 * Conversion Clean 9 -> Vital5 : le KPI en or du réseau FLP.
 */

export interface ConversionStats {
  totalValidated: number;
  convertedCount: number;         // achats suivis d'un réachat du même client
  conversionRate: number;         // 0-100 (achats convertis / achats "opportunité")
  clean9Count: number;            // achats Clean 9 suivis d'une opportunité
  clean9ConvertedToVital5: number;
  clean9ToVital5Rate: number;
  repeatCustomers: number;        // clients avec ≥2 achats validés
  avgOrdersPerCustomer: number;
  satisfactionBreakdown: { LOW: number; MID: number; HIGH: number };
}

const isClean9 = (o: Order): boolean => {
  const hay = o.items.map(i => i.productName).join(' ').toLowerCase();
  return hay.includes('clean 9') || hay.includes('clean9');
};

const hasVital5 = (o: Order): boolean => {
  const hay = o.items.map(i => i.productName).join(' ').toLowerCase();
  return hay.includes('vital5') || hay.includes('vital 5');
};

/** Marque les commandes converties et calcule toutes les stats. */
export function computeConversionStats(orders: Order[], customers: Customer[]): ConversionStats {
  void customers; // réservé pour filtres futurs
  const validated = orders
    .filter(o => o.status === ('VALIDATED' as any))
    .slice()
    .sort((a, b) => (a.validatedAt || a.date).localeCompare(b.validatedAt || b.date));

  // Grouper par client
  const byCustomer = new Map<string, Order[]>();
  for (const o of validated) {
    if (!byCustomer.has(o.customerId)) byCustomer.set(o.customerId, []);
    byCustomer.get(o.customerId)!.push(o);
  }

  let convertedCount = 0;
  let opportunityCount = 0;
  let clean9Opportunities = 0;
  let clean9Converted = 0;

  for (const list of byCustomer.values()) {
    for (let i = 0; i < list.length; i++) {
      const later = list.slice(i + 1);
      if (later.length === 0) continue;          // dernier achat : pas encore d'opportunité mesurable
      opportunityCount++;
      convertedCount++;                          // il y a au moins un réachat après

      const o = list[i];
      if (isClean9(o)) {
        clean9Opportunities++;
        if (later.some(hasVital5)) clean9Converted++;
      }
    }
  }

  const repeatCustomers = [...byCustomer.values()].filter(l => l.length >= 2).length;

  const sat = { LOW: 0, MID: 0, HIGH: 0 };
  for (const o of validated) {
    if (o.satisfactionLevel) sat[o.satisfactionLevel]++;
  }

  return {
    totalValidated: validated.length,
    convertedCount,
    conversionRate: opportunityCount > 0 ? Math.round((convertedCount / opportunityCount) * 100) : 0,
    clean9Count: clean9Opportunities,
    clean9ConvertedToVital5: clean9Converted,
    clean9ToVital5Rate: clean9Opportunities > 0 ? Math.round((clean9Converted / clean9Opportunities) * 100) : 0,
    repeatCustomers,
    avgOrdersPerCustomer: byCustomer.size > 0 ? Math.round((validated.length / byCustomer.size) * 10) / 10 : 0,
    satisfactionBreakdown: sat,
  };
}
