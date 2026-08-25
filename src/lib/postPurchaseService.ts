import { Order, Customer } from '../types';

/**
 * Suivi post-achat — le cœur du business FLP :
 * J+3 = la consommation a-t-elle commencé ? (produit arrivé, mode d'emploi)
 * J+7 = satisfaction + témoignage + préparation du réachat
 * Le Clean 9 dure 9 jours : J+9/J+10 = moment de reconversion naturel.
 */

export type FollowUpMilestone = 'J0' | 'J3' | 'J7' | 'J10' | 'DONE';

export interface PurchaseFollowUp {
  order: Order;
  customer?: Customer;
  milestone: FollowUpMilestone;
  daysSince: number;
  title: string;
  message: string;
  urgency: 'done' | 'upcoming' | 'today' | 'due';
}

const DAY_MS = 1000 * 60 * 60 * 24;

const todayMidnight = (): number => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const parseSafe = (s?: string): Date | null => {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

/** Date de référence d'un achat : validation si elle existe, sinon date commande. */
export const purchaseAnchorDate = (o: Order): string =>
  o.validatedAt && !isNaN(new Date(o.validatedAt).getTime()) ? o.validatedAt.split('T')[0] : o.date;

const MILESTONES: { key: FollowUpMilestone; offset: number; title: string; message: string }[] = [
  {
    key: 'J3',
    offset: 3,
    title: 'Démarrage produit',
    message: 'Le produit est-il bien arrivé et démarré ? Vérifie le bon usage — c’est là que se joue l’adhésion.',
  },
  {
    key: 'J7',
    offset: 7,
    title: 'Satisfaction & résultats',
    message: 'Demande ses premières sensations/résultats. Un client satisfait = témoignage + futur réachat.',
  },
  {
    key: 'J10',
    offset: 10,
    title: 'Réachat / Programme suivant',
    message: 'Fin du cycle Clean 9 approchée : propose Vital5 ou le programme suivant maintenant.',
  },
];

/**
 * État de suivi d'une commande validée.
 * - DONE quand tous les jalons sont passés depuis plus de 4 jours.
 */
export function computePurchaseFollowUp(order: Order, customers: Customer[]): PurchaseFollowUp {
  const anchor = parseSafe(purchaseAnchorDate(order));
  const anchorTime = anchor ? anchor.setHours(0, 0, 0, 0) : todayMidnight();
  const daysSince = Math.floor((todayMidnight() - anchorTime) / DAY_MS);

  const customer = customers.find(c => c.id === order.customerId);

  // Jalons franchis il y a plus de 4 jours -> suivi terminé
  if (daysSince > 14) {
    return { order, customer, milestone: 'DONE', daysSince, title: '', message: '', urgency: 'done' };
  }

  // Trouver le jalon à venir ou du jour
  let current = MILESTONES[MILESTONES.length - 1];
  for (const m of MILESTONES) {
    if (daysSince <= m.offset) {
      // jour du jalon ou avant
      if (daysSince === m.offset) {
        return { order, customer, milestone: m.key, daysSince, title: m.title, message: m.message, urgency: 'today' };
      }
      // entre deux jalons : on montre le prochain
      current = m;
      break;
    }
    current = m;
  }

  // daysSince > dernier jalon mais <= 14 : en fenêtre de réachat
  if (daysSince >= 11) {
    return {
      order,
      customer,
      milestone: 'J10',
      daysSince,
      title: MILESTONES[2].title,
      message: MILESTONES[2].message,
      urgency: 'due',
    };
  }

  return {
    order,
    customer,
    milestone: current.key,
    daysSince,
    title: current.title,
    message: current.message,
    urgency: 'upcoming',
  };
}

/** Tous les suivis actifs (commandes validées des 14 derniers jours), triés par priorité. */
export function getActivePurchaseFollowUps(orders: Order[], customers: Customer[]): PurchaseFollowUp[] {
  const priority: Record<PurchaseFollowUp['urgency'], number> = { due: 0, today: 1, upcoming: 2, done: 3 };
  return orders
    .filter(o => o.status === ('VALIDATED' as any))
    .map(o => computePurchaseFollowUp(o, customers))
    .filter(f => f.urgency !== 'done')
    .sort((a, b) => priority[a.urgency] - priority[b.urgency] || a.daysSince - b.daysSince);
}
