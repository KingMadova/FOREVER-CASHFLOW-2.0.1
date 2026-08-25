import { Customer, PipelineStage } from '../types';

/**
 * Service de relances prospects.
 * Règle métier : chaque étape du pipeline a son délai maximal de silence.
 * Au-delà, le prospect devient une relance à faire (urgente si dépassé).
 */

// Délai maximal (en jours) sans contact par étape du pipeline
export const RELANCE_DELAYS: Record<PipelineStage, number | null> = {
  CONTACT_INITIATED: 3,      // Un contact frais doit être recroisé sous 3 jours
  PRESENTATION_DONE: 2,      // Après présentation, l'argent refroidit vite
  FOLLOW_UP_REQUIRED: 1,     // Déjà marqué "à suivre" -> relance quotidienne
  CLOSED_WON: null,          // Client gagné -> relances commerciales hors périmètre
  CLOSED_LOST: null,         // Perdu -> pas de relance automatique
};

export type RelanceUrgency = 'ok' | 'today' | 'due' | 'late';

export interface RelanceInfo {
  customer: Customer;
  daysSinceContact: number;
  daysRemaining: number;      // négatif = en retard
  urgency: RelanceUrgency;
  label: string;              // ex: "À relancer depuis 2 jours"
}

const DAY_MS = 1000 * 60 * 60 * 24;

const todayMidnight = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const parseDateSafe = (dateStr?: string): Date | null => {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};

/** Calcule l'état de relance d'un prospect. Retourne null si aucune relance requise. */
export function computeRelance(customer: Customer): RelanceInfo | null {
  const delay = RELANCE_DELAYS[customer.pipelineStage];
  if (delay == null) return null; // stage sans relance auto

  // Ne relancer que les PROSPECTS (les CLIENTS ont un suivi différent).
  // Certains clients récents peuvent rester au stage CLOSED_WON : exclus par delay=null.
  const last = parseDateSafe(customer.lastContactDate);
  if (!last) {
    return {
      customer,
      daysSinceContact: 999,
      daysRemaining: -delay,
      urgency: 'late',
      label: `Jamais contacté — relance immédiate (${stageLabel(customer.pipelineStage)})`,
    };
  }

  const daysSince = Math.floor((todayMidnight().getTime() - last.setHours(0, 0, 0, 0)) / DAY_MS);
  const remaining = delay - daysSince;

  if (remaining > 1) return null; // pas encore le moment

  let urgency: RelanceUrgency;
  let label: string;
  if (remaining <= -1) {
    urgency = 'late';
    label = `À relancer depuis ${Math.abs(remaining)} jour${Math.abs(remaining) > 1 ? 's' : ''}`;
  } else if (remaining === 0) {
    urgency = 'due';
    label = 'À relancer aujourd’hui';
  } else {
    urgency = 'today';
    label = 'À relancer demain — prépare ton approche';
  }

  return { customer, daysSinceContact: daysSince, daysRemaining: remaining, urgency, label };
}

/** Toutes les relances actives, triées de la plus urgente à la moins urgente. */
export function getActiveRelances(customers: Customer[]): RelanceInfo[] {
  return customers
    .map(computeRelance)
    .filter((r): r is RelanceInfo => r !== null)
    .sort((a, b) => {
      const order: Record<RelanceUrgency, number> = { late: 0, due: 1, today: 2, ok: 3 };
      if (order[a.urgency] !== order[b.urgency]) return order[a.urgency] - order[b.urgency];
      return a.daysSinceContact - b.daysSinceContact ? a.customer.lastContactDate.localeCompare(b.customer.lastContactDate) : 0;
    });
}

export function stageLabel(stage: PipelineStage): string {
  switch (stage) {
    case 'CONTACT_INITIATED': return 'Contact initialisé';
    case 'PRESENTATION_DONE': return 'Présentation faite';
    case 'FOLLOW_UP_REQUIRED': return 'Suivi requis';
    case 'CLOSED_WON': return 'Vente conclue';
    case 'CLOSED_LOST': return 'Perdu';
    default: return stage;
  }
}
