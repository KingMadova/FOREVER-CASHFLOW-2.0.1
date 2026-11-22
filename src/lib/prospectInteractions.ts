import {
  ConversionChannel,
  Customer,
  InteractionActionType,
  InteractionChannel,
  InteractionOutcome,
  ProspectInteraction,
} from '../types';

export const INTERACTION_CHANNELS: { code: InteractionChannel; label: string }[] = [
  { code: 'WHATSAPP', label: 'WhatsApp' },
  { code: 'SMS', label: 'SMS' },
  { code: 'APPEL', label: 'Appel' },
  { code: 'PRESENTATION', label: 'Présentation' },
  { code: 'AUTRE', label: 'Autre' },
];

export const CONVERSION_CHANNELS: { code: ConversionChannel; label: string }[] = [
  ...INTERACTION_CHANNELS,
  { code: 'INCONNU', label: 'Inconnu / Non attribuable' },
];

export const INTERACTION_ACTION_TYPES: { code: InteractionActionType; label: string }[] = [
  { code: 'PREMIER_CONTACT', label: 'Premier contact' },
  { code: 'RELANCE', label: 'Relance' },
  { code: 'PRESENTATION', label: 'Présentation' },
  { code: 'AUTRE', label: 'Autre' },
];

export const INTERACTION_OUTCOMES: {
  code: InteractionOutcome;
  label: string;
  countsAsResponse: boolean;
}[] = [
  { code: 'SANS_REPONSE', label: 'Sans réponse', countsAsResponse: false },
  { code: 'INTERESSE', label: 'Intéressé', countsAsResponse: true },
  { code: 'REFUS', label: 'Refus', countsAsResponse: true },
  { code: 'PRESENTATION_PROGRAMMEE', label: 'Présentation programmée', countsAsResponse: true },
  { code: 'CONVERTI', label: 'Converti', countsAsResponse: true },
];

export const RESPONSE_OUTCOMES: ReadonlySet<InteractionOutcome> = new Set<InteractionOutcome>([
  'INTERESSE',
  'REFUS',
  'PRESENTATION_PROGRAMMEE',
  'CONVERTI',
]);

export function isResponseOutcome(outcome: InteractionOutcome): boolean {
  return RESPONSE_OUTCOMES.has(outcome);
}

export function getInteractionChannelLabel(channel?: string | null): string {
  return CONVERSION_CHANNELS.find((c) => c.code === channel)?.label ?? 'Autre';
}

export function getInteractionActionLabel(actionType?: string | null): string {
  return INTERACTION_ACTION_TYPES.find((a) => a.code === actionType)?.label ?? 'Autre';
}

export function getInteractionOutcomeLabel(outcome?: string | null): string {
  return INTERACTION_OUTCOMES.find((o) => o.code === outcome)?.label ?? 'Sans réponse';
}

/**
 * Valide strictement qu'une chaîne correspond à une date calendaire réelle au format YYYY-MM-DD
 * (ou débute par un préfixe ISO YYYY-MM-DD valide suivi de T ou fin de chaîne).
 * Rejette notamment les dates impossibles (ex: 2026-02-30, 2026-13-01, chaînes arbitraires).
 */
export function normalizeValidIsoDate(value?: string | null): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  if (!match) return '';

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    year < 1900 ||
    year > 2100 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return '';
  }

  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day
  ) {
    return '';
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function isValidCalendarIsoDate(value?: string | null): boolean {
  return normalizeValidIsoDate(value) !== '';
}

/**
 * Retourne la date calendaire YYYY-MM-DD la plus récente parmi les candidates valides.
 * Ignore toute chaîne vide, malformée ou calendairement impossible.
 */
export function maxIsoDate(...candidates: Array<string | null | undefined>): string {
  let best = '';
  for (const candidate of candidates) {
    const valid = normalizeValidIsoDate(candidate);
    if (!valid) continue;
    if (!best || valid > best) {
      best = valid;
    }
  }
  return best;
}

export function generateInteractionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `int_${crypto.randomUUID().replace(/-/g, '')}`;
  }
  return `int_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export interface CreateProspectInteractionInput {
  id?: string;
  date: string;
  channel: InteractionChannel;
  actionType: InteractionActionType;
  outcome: InteractionOutcome;
  notes?: string;
  nextFollowUpDate?: string;
}

const VALID_CHANNELS = new Set<InteractionChannel>([
  'WHATSAPP',
  'SMS',
  'APPEL',
  'PRESENTATION',
  'AUTRE',
]);

const VALID_ACTION_TYPES = new Set<InteractionActionType>([
  'PREMIER_CONTACT',
  'RELANCE',
  'PRESENTATION',
  'AUTRE',
]);

const VALID_OUTCOMES = new Set<InteractionOutcome>([
  'SANS_REPONSE',
  'INTERESSE',
  'REFUS',
  'PRESENTATION_PROGRAMMEE',
  'CONVERTI',
]);

export function sanitizeInteractionForFirestore(
  interaction: ProspectInteraction,
): ProspectInteraction {
  const clean: ProspectInteraction = {
    id: String(interaction.id).trim(),
    date: normalizeValidIsoDate(interaction.date) || interaction.date,
    channel: interaction.channel,
    actionType: interaction.actionType,
    outcome: interaction.outcome,
    createdAt: interaction.createdAt,
  };
  if (typeof interaction.notes === 'string' && interaction.notes.trim().length > 0) {
    clean.notes = interaction.notes.trim();
  }
  const cleanNext = normalizeValidIsoDate(interaction.nextFollowUpDate);
  if (cleanNext) {
    clean.nextFollowUpDate = cleanNext;
  }
  return clean;
}

/**
 * Construit une interaction structurée immuable et normalisée (sans propriété undefined)
 * pour garantir l'idempotence d'arrayUnion lors des reprises réseau.
 */
export function buildProspectInteraction(
  input: CreateProspectInteractionInput,
  nowIso: string = new Date().toISOString(),
): ProspectInteraction {
  const validDate = normalizeValidIsoDate(input.date);
  if (!validDate) {
    throw new Error("La date de l'interaction est invalide (format YYYY-MM-DD requis).");
  }

  if (!VALID_CHANNELS.has(input.channel)) {
    throw new Error("Le canal de l'interaction est invalide.");
  }

  if (!VALID_ACTION_TYPES.has(input.actionType)) {
    throw new Error("Le type d'action de l'interaction est invalide.");
  }

  if (!VALID_OUTCOMES.has(input.outcome)) {
    throw new Error("Le résultat de l'interaction est invalide.");
  }

  let validNextFollowUp: string | undefined;
  if (typeof input.nextFollowUpDate === 'string' && input.nextFollowUpDate.trim() !== '') {
    validNextFollowUp = normalizeValidIsoDate(input.nextFollowUpDate);
    if (!validNextFollowUp) {
      throw new Error('La date de prochaine relance est invalide.');
    }
  }

  const trimmedNotes = typeof input.notes === 'string' ? input.notes.trim() : '';
  const id = (input.id || '').trim() || generateInteractionId();

  return sanitizeInteractionForFirestore({
    id,
    date: validDate,
    channel: input.channel,
    actionType: input.actionType,
    outcome: input.outcome,
    ...(trimmedNotes ? { notes: trimmedNotes } : {}),
    ...(validNextFollowUp ? { nextFollowUpDate: validNextFollowUp } : {}),
    createdAt: nowIso,
  });
}

/**
 * Fusionne et déduplique des listes d'interactions par `id`, triées chronologiquement.
 */
export function mergeInteractionsUnique(
  existing: ProspectInteraction[] | undefined,
  incoming: ProspectInteraction[] | undefined,
): ProspectInteraction[] {
  const byId = new Map<string, ProspectInteraction>();
  for (const item of [...(existing || []), ...(incoming || [])]) {
    if (!item || typeof item.id !== 'string' || !item.id.trim()) continue;
    const clean = sanitizeInteractionForFirestore(item);
    if (!byId.has(clean.id)) {
      byId.set(clean.id, clean);
    }
  }
  return Array.from(byId.values()).sort((a, b) => {
    const da = normalizeValidIsoDate(a.date);
    const db = normalizeValidIsoDate(b.date);
    if (da !== db) return da.localeCompare(db);
    if (a.createdAt !== b.createdAt) return a.createdAt.localeCompare(b.createdAt);
    return a.id.localeCompare(b.id);
  });
}

/**
 * Calcule la date de dernier contact effective (jamais inférieure aux interactions connues).
 */
export function getEffectiveLastContactDate(
  customer: Pick<Customer, 'lastContactDate' | 'interactions'>,
): string {
  const interactionDates = (customer.interactions || []).map((i) => i.date);
  return maxIsoDate(customer.lastContactDate, ...interactionDates);
}

/**
 * Retire strictement le champ `interactions` d'un payload CUSTOMER UPDATE
 * afin qu'aucune mise à jour de fiche client n'écrase le journal d'interactions.
 */
export function stripInteractionsFromCustomerUpdatePayload<T extends Record<string, unknown>>(
  payload: T,
): Omit<T, 'interactions'> {
  if (!payload || typeof payload !== 'object') {
    return {} as Omit<T, 'interactions'>;
  }
  const { interactions: _interactions, ...rest } = payload;
  return rest;
}
