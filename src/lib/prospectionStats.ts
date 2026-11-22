import {
  AgendaItem,
  Customer,
  CustomerStatus,
  InteractionChannel,
  PipelineStage,
} from '../types';
import { localDateISO } from './orderStats';
import {
  INTERACTION_CHANNELS,
  isResponseOutcome,
  normalizeValidIsoDate,
} from './prospectInteractions';

export type ProspectionPeriod = 'all' | '7' | '30' | 'month' | '90' | 'year';

export type AcquisitionSourceCode =
  | 'META_ADS'
  | 'RECOMMANDATION'
  | 'BOUCHE_OREILLE'
  | 'EVENEMENT'
  | 'AUTRE';

export const ACQUISITION_SOURCES: { code: AcquisitionSourceCode; label: string }[] = [
  { code: 'META_ADS', label: 'Meta Ads' },
  { code: 'RECOMMANDATION', label: 'Recommandation' },
  { code: 'BOUCHE_OREILLE', label: 'Bouche-à-oreille' },
  { code: 'EVENEMENT', label: 'Événements' },
  { code: 'AUTRE', label: 'Autres sources' },
];

export const PIPELINE_FUNNEL_META: {
  code: PipelineStage;
  label: string;
  description: string;
}[] = [
  { code: 'CONTACT_INITIATED', label: 'Initié', description: 'Contact pris' },
  { code: 'PRESENTATION_DONE', label: 'Présenté', description: 'Présentation FLP faite' },
  { code: 'FOLLOW_UP_REQUIRED', label: 'Relance', description: 'Suivi requis' },
  { code: 'CLOSED_WON', label: 'Converti', description: 'Client / FBO gagné' },
  { code: 'CLOSED_LOST', label: 'Perdu / Standby', description: 'Non intéressé' },
];

export type ProspectionCustomerKind =
  | 'DIRECT_CLIENT'
  | 'HISTORICAL_UNATTRIBUTED_CLIENT'
  | 'CONVERTED_PROSPECT'
  | 'ACTIVE_PROSPECT'
  | 'LOST_PROSPECT';

export interface ProspectionOverviewKpis {
  totalProspects: number;
  activeProspects: number;
  newRegistrations: number;
  newRegistrationsHint: string;
  contactedCount: number;
  interactionContactedCount: number;
  respondedCount: number | null;
  responseRatePct: number | null;
  presentationsCount: number;
  waitingFollowUpCount: number;
  overdueFollowUpsCount: number;
  convertedCount: number;
  conversionsInPeriodByConvertedAtCount: number;
  lostCount: number;
  conversionRatePct: number | null;
  unattributedHistoricalClientsCount: number;
}

export interface ChannelPerformanceRow {
  channel: InteractionChannel;
  label: string;
  contactedProspectsCount: number;
  respondedProspectsCount: number;
  convertedProspectsCount: number;
  interactionsCount: number;
  responseRatePct: number | null;
  conversionRatePct: number | null;
  rank: number | null;
}

export interface ChannelPerformanceSummary {
  rows: ChannelPerformanceRow[];
  totalCohortProspects: number;
  totalContactedWithInteractions: number;
  unknownChannelConversionsCount: number;
  attributedWithoutChannelInteractionCount: number;
}

export interface AcquisitionSourceRow {
  source: AcquisitionSourceCode;
  label: string;
  totalCount: number;
  activeCount: number;
  presentationsCount: number;
  convertedCount: number;
  lostCount: number;
  conversionRatePct: number | null;
  shareOfTotalPct: number | null;
  rank: number | null;
}

export interface FunnelStageRow {
  stage: PipelineStage;
  label: string;
  description: string;
  count: number;
  sharePct: number | null;
}

export interface StagnatingProspectInfo {
  customer: Customer;
  daysSinceLastContact: number | null;
}

export interface ConversionFunnelSummary {
  totalInScope: number;
  stages: FunnelStageRow[];
  convertedCount: number;
  lostCount: number;
  conversionRatePct: number | null;
  lossRatePct: number | null;
  stagnatingProspects: StagnatingProspectInfo[];
}

export interface EnrichedFollowUpItem {
  item: AgendaItem;
  matchedCustomer: Customer | null;
  daysOverdue: number;
}

export interface FollowUpSummary {
  todayCount: number;
  overdueCount: number;
  scheduledCount: number;
  completedCount: number;
  withoutNextActionCount: number;
  todayItems: EnrichedFollowUpItem[];
  overdueItems: EnrichedFollowUpItem[];
  scheduledItems: EnrichedFollowUpItem[];
  completedItems: EnrichedFollowUpItem[];
  prospectsWithoutNextAction: Customer[];
}

export function normalizeDateStr(value?: string | null): string {
  if (!value) return '';
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

export function parseDateUTC(dateStr: string): number | null {
  const norm = normalizeDateStr(dateStr);
  if (!norm) return null;
  const [y, m, d] = norm.split('-').map(Number);
  if (!y || !m || !d) return null;
  return Date.UTC(y, m - 1, d);
}

export function diffDaysISO(fromISO: string, toISO: string): number | null {
  const fromMs = parseDateUTC(fromISO);
  const toMs = parseDateUTC(toISO);
  if (fromMs === null || toMs === null) return null;
  return Math.floor((toMs - fromMs) / 86_400_000);
}

export function getProspectionDateRange(
  period: ProspectionPeriod,
  todayStr: string = localDateISO(),
): { startKey: string; endKey: string } | null {
  if (period === 'all') return null;

  const [y, m, d] = todayStr.split('-').map(Number);
  const endDate = new Date(y, (m || 1) - 1, d || 1);
  const startDate = new Date(endDate);

  switch (period) {
    case '7':
      startDate.setDate(startDate.getDate() - 6);
      break;
    case '30':
      startDate.setDate(startDate.getDate() - 29);
      break;
    case 'month':
      startDate.setDate(1);
      break;
    case '90':
      startDate.setDate(startDate.getDate() - 89);
      break;
    case 'year':
      startDate.setMonth(0, 1);
      break;
  }

  return {
    startKey: localDateISO(startDate),
    endKey: localDateISO(endDate),
  };
}

export function classifyCustomerForProspection(customer: Customer): ProspectionCustomerKind {
  // 1. Client créé directement depuis ClientsView sans passer par la prospection
  if (customer.recordOrigin === 'DIRECT_CLIENT' && !customer.convertedFromProspect) {
    return 'DIRECT_CLIENT';
  }

  // 2. Conversion réelle traçable depuis la prospection
  if (
    customer.convertedFromProspect === true ||
    Boolean((customer as { convertedAt?: string }).convertedAt) ||
    (customer.recordOrigin === 'PROSPECTION' &&
      (customer.status === CustomerStatus.CLIENT || customer.pipelineStage === 'CLOSED_WON')) ||
    (customer.status === CustomerStatus.PROSPECT && customer.pipelineStage === 'CLOSED_WON')
  ) {
    return 'CONVERTED_PROSPECT';
  }

  // 3. Prospect actif ou perdu
  if (customer.status === CustomerStatus.PROSPECT) {
    return customer.pipelineStage === 'CLOSED_LOST' ? 'LOST_PROSPECT' : 'ACTIVE_PROSPECT';
  }

  // 4. Ancien document CLIENT sans traçabilité d'origine ni marqueur de conversion -> non attribuable
  return 'HISTORICAL_UNATTRIBUTED_CLIENT';
}

export function isProspectionCohortMember(customer: Customer): boolean {
  const kind = classifyCustomerForProspection(customer);
  return kind === 'CONVERTED_PROSPECT' || kind === 'ACTIVE_PROSPECT' || kind === 'LOST_PROSPECT';
}

export function isConvertedContact(customer: Customer): boolean {
  return classifyCustomerForProspection(customer) === 'CONVERTED_PROSPECT';
}

export function isActiveProspect(customer: Customer): boolean {
  return classifyCustomerForProspection(customer) === 'ACTIVE_PROSPECT';
}

export function normalizeAcquisitionSource(
  source?: Customer['sourceProspection'],
): AcquisitionSourceCode {
  if (
    source === 'META_ADS' ||
    source === 'RECOMMANDATION' ||
    source === 'BOUCHE_OREILLE' ||
    source === 'EVENEMENT' ||
    source === 'AUTRE'
  ) {
    return source;
  }
  return 'AUTRE';
}

export function filterCustomersByPeriod(
  customers: Customer[],
  period: ProspectionPeriod,
  todayStr: string = localDateISO(),
): Customer[] {
  const range = getProspectionDateRange(period, todayStr);
  if (!range) return customers;
  return customers.filter((customer) => {
    const created = normalizeDateStr(customer.createdAt);
    if (!created) return false;
    return created >= range.startKey && created <= range.endKey;
  });
}

function normalizePhoneDigits(phone?: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 8) {
    return digits.slice(-8);
  }
  return digits;
}

function normalizeName(name?: string): string {
  return (name || '').trim().toLocaleLowerCase('fr-FR');
}

/**
 * Résout de manière stricte et univoque le contact associé à une tâche Agenda :
 * 1. Si `customerId` est renseigné -> correspondance exacte par ID uniquement.
 * 2. Sinon (tâche existante sans `customerId`) :
 *    - priorité au téléphone s'il identifie un SEUL client ;
 *    - sinon (absence de téléphone exploitable), nom uniquement s'il identifie un SEUL client.
 * 3. Aucune association automatique si plusieurs clients correspondent ou si le téléphone diffère.
 */
export function resolveAgendaItemCustomer(
  item: AgendaItem,
  customers: Customer[],
): Customer | null {
  const explicitId = (item.customerId || '').trim();
  if (explicitId) {
    return customers.find((c) => c.id === explicitId) ?? null;
  }

  const itemPhone = normalizePhoneDigits(item.contactPhone);
  if (itemPhone.length >= 6) {
    const phoneMatches = customers.filter(
      (c) => normalizePhoneDigits(c.phone) === itemPhone,
    );
    return phoneMatches.length === 1 ? phoneMatches[0] : null;
  }

  const itemName = normalizeName(item.contactName);
  if (itemName) {
    const nameMatches = customers.filter((c) => normalizeName(c.name) === itemName);
    return nameMatches.length === 1 ? nameMatches[0] : null;
  }

  return null;
}

/**
 * KPI globaux du pilotage de la prospection (Étape 1 + Étape 2).
 * - Préserve strictement la cohorte d'acquisition filtrée par `createdAt`.
 * - Calcule `respondedCount` / `responseRatePct` par unicité prospect à partir des interactions
 *   enregistrées (`INTERESSE`, `REFUS`, `PRESENTATION_PROGRAMMEE`, `CONVERTI` = réponses).
 * - Retourne `null` (« Données insuffisantes ») tant qu'aucune interaction n'existe dans la cohorte.
 * - Distingue `conversionsInPeriodByConvertedAtCount` (date réelle `convertedAt`) de `convertedCount` (cohorte `createdAt`).
 */
export function computeProspectionOverviewKpis(
  customers: Customer[],
  agendaList: AgendaItem[],
  period: ProspectionPeriod,
  todayStr: string = localDateISO(),
): ProspectionOverviewKpis {
  const periodCustomers = filterCustomersByPeriod(customers, period, todayStr);
  const scoped = periodCustomers.filter(isProspectionCohortMember);
  const unattributedHistoricalClientsCount = periodCustomers.filter(
    (c) => classifyCustomerForProspection(c) === 'HISTORICAL_UNATTRIBUTED_CLIENT',
  ).length;

  const totalProspects = scoped.length;
  const activeProspects = scoped.filter(isActiveProspect).length;

  let newRegistrations = scoped.length;
  let newRegistrationsHint = 'inscrits sur la période';
  if (period === 'all') {
    const last30Range = getProspectionDateRange('30', todayStr)!;
    newRegistrations = customers.filter((c) => {
      if (!isProspectionCohortMember(c)) return false;
      const created = normalizeDateStr(c.createdAt);
      return Boolean(created && created >= last30Range.startKey && created <= last30Range.endKey);
    }).length;
    newRegistrationsHint = '30 derniers jours';
  }

  const contactedCount = scoped.filter(
    (c) => (c.interactions?.length ?? 0) > 0 || Boolean(normalizeDateStr(c.lastContactDate)),
  ).length;
  const prospectsWithInteractions = scoped.filter((c) => (c.interactions?.length ?? 0) > 0);
  const interactionContactedCount = prospectsWithInteractions.length;
  const respondedCount =
    interactionContactedCount > 0
      ? prospectsWithInteractions.filter((c) =>
          (c.interactions || []).some((i) => isResponseOutcome(i.outcome)),
        ).length
      : null;
  const responseRatePct =
    interactionContactedCount > 0 && respondedCount !== null
      ? (respondedCount / interactionContactedCount) * 100
      : null;

  const presentationsCount = scoped.filter(
    (c) => c.status === CustomerStatus.PROSPECT && c.pipelineStage === 'PRESENTATION_DONE',
  ).length;
  const waitingFollowUpCount = scoped.filter(
    (c) => c.status === CustomerStatus.PROSPECT && c.pipelineStage === 'FOLLOW_UP_REQUIRED',
  ).length;
  const convertedCount = scoped.filter(isConvertedContact).length;
  const lostCount = scoped.filter(
    (c) => classifyCustomerForProspection(c) === 'LOST_PROSPECT',
  ).length;

  const periodRange = getProspectionDateRange(period, todayStr);
  const conversionsInPeriodByConvertedAtCount = customers.filter((c) => {
    if (!isConvertedContact(c)) return false;
    const convDate = normalizeValidIsoDate(c.convertedAt);
    if (!convDate) return false;
    if (!periodRange) return true;
    return convDate >= periodRange.startKey && convDate <= periodRange.endKey;
  }).length;

  const overdueFollowUpsCount = agendaList.filter((item) => {
    if (item.completed) return false;
    if (item.type !== 'FOLLOW_UP') return false;
    const itemDate = normalizeDateStr(item.date);
    return Boolean(itemDate && itemDate < todayStr);
  }).length;

  return {
    totalProspects,
    activeProspects,
    newRegistrations,
    newRegistrationsHint,
    contactedCount,
    interactionContactedCount,
    respondedCount,
    responseRatePct,
    presentationsCount,
    waitingFollowUpCount,
    overdueFollowUpsCount,
    convertedCount,
    conversionsInPeriodByConvertedAtCount,
    lostCount,
    conversionRatePct: totalProspects > 0 ? (convertedCount / totalProspects) * 100 : null,
    unattributedHistoricalClientsCount,
  };
}

/**
 * Performance par canal de contact (Étape 2) sur la cohorte d'acquisition (Étape 1 préservée) :
 * - Taux de réponse(c) = (Prospects uniques avec >= 1 réponse sur c / Prospects uniques contactés sur c) × 100
 * - Taux de conversion(c) = (Prospects uniques convertis, attribués à c et ayant >= 1 interaction sur c / Prospects uniques contactés sur c) × 100
 * - Résultats comptant comme réponse : INTERESSE, REFUS, PRESENTATION_PROGRAMMEE, CONVERTI.
 * - Chaque numérateur est mathématiquement inclus dans le dénominateur (jamais > 100 %).
 * - Retourne null (« Données insuffisantes ») si 0 prospect contacté sur ce canal.
 */
export function computeChannelPerformanceStats(
  customers: Customer[],
  period: ProspectionPeriod,
  todayStr: string = localDateISO(),
): ChannelPerformanceSummary {
  const scoped = filterCustomersByPeriod(customers, period, todayStr).filter(
    isProspectionCohortMember,
  );

  const uniqueWithAnyInteraction = new Set<string>();
  let unknownChannelConversionsCount = 0;
  let attributedWithoutChannelInteractionCount = 0;

  for (const customer of scoped) {
    if ((customer.interactions?.length ?? 0) > 0) {
      uniqueWithAnyInteraction.add(customer.id);
    }
    if (isConvertedContact(customer)) {
      if (!customer.conversionChannel || customer.conversionChannel === 'INCONNU') {
        unknownChannelConversionsCount += 1;
      } else if (
        !(customer.interactions || []).some((i) => i.channel === customer.conversionChannel)
      ) {
        attributedWithoutChannelInteractionCount += 1;
      }
    }
  }

  const rowsWithoutRank: Omit<ChannelPerformanceRow, 'rank'>[] = INTERACTION_CHANNELS.map(
    ({ code, label }) => {
      const contactedIds = new Set<string>();
      const respondedIds = new Set<string>();
      const convertedIds = new Set<string>();
      let interactionsCount = 0;

      for (const customer of scoped) {
        const channelInteractions = (customer.interactions || []).filter(
          (i) => i.channel === code,
        );
        if (channelInteractions.length === 0) continue;

        contactedIds.add(customer.id);
        interactionsCount += channelInteractions.length;

        if (channelInteractions.some((i) => isResponseOutcome(i.outcome))) {
          respondedIds.add(customer.id);
        }

        if (isConvertedContact(customer) && customer.conversionChannel === code) {
          convertedIds.add(customer.id);
        }
      }

      const contactedProspectsCount = contactedIds.size;
      const respondedProspectsCount = respondedIds.size;
      const convertedProspectsCount = convertedIds.size;

      return {
        channel: code,
        label,
        contactedProspectsCount,
        respondedProspectsCount,
        convertedProspectsCount,
        interactionsCount,
        responseRatePct:
          contactedProspectsCount > 0
            ? (respondedProspectsCount / contactedProspectsCount) * 100
            : null,
        conversionRatePct:
          contactedProspectsCount > 0
            ? (convertedProspectsCount / contactedProspectsCount) * 100
            : null,
      };
    },
  );

  rowsWithoutRank.sort((a, b) => {
    const aHas = a.contactedProspectsCount > 0 ? 1 : 0;
    const bHas = b.contactedProspectsCount > 0 ? 1 : 0;
    if (bHas !== aHas) return bHas - aHas;
    const convDiff = (b.conversionRatePct ?? -1) - (a.conversionRatePct ?? -1);
    if (Math.abs(convDiff) > 1e-9) return convDiff;
    const respDiff = (b.responseRatePct ?? -1) - (a.responseRatePct ?? -1);
    if (Math.abs(respDiff) > 1e-9) return respDiff;
    return b.contactedProspectsCount - a.contactedProspectsCount;
  });

  let rank = 0;
  const rows: ChannelPerformanceRow[] = rowsWithoutRank.map((row) => {
    if (row.contactedProspectsCount === 0) {
      return { ...row, rank: null };
    }
    rank += 1;
    return { ...row, rank };
  });

  return {
    rows,
    totalCohortProspects: scoped.length,
    totalContactedWithInteractions: uniqueWithAnyInteraction.size,
    unknownChannelConversionsCount,
    attributedWithoutChannelInteractionCount,
  };
}

/**
 * Performance par source d'acquisition (`sourceProspection`) sur la cohorte de prospection.
 * Exclut les clients directs et les anciens clients non attribuables.
 */
export function computeAcquisitionSourceStats(
  customers: Customer[],
  period: ProspectionPeriod,
  todayStr: string = localDateISO(),
): AcquisitionSourceRow[] {
  const scoped = filterCustomersByPeriod(customers, period, todayStr).filter(isProspectionCohortMember);
  const totalInScope = scoped.length;

  const buckets = new Map<
    AcquisitionSourceCode,
    {
      totalCount: number;
      activeCount: number;
      presentationsCount: number;
      convertedCount: number;
      lostCount: number;
    }
  >();

  for (const src of ACQUISITION_SOURCES) {
    buckets.set(src.code, {
      totalCount: 0,
      activeCount: 0,
      presentationsCount: 0,
      convertedCount: 0,
      lostCount: 0,
    });
  }

  for (const customer of scoped) {
    const code = normalizeAcquisitionSource(customer.sourceProspection);
    const bucket = buckets.get(code)!;
    bucket.totalCount += 1;
    if (isActiveProspect(customer)) bucket.activeCount += 1;
    if (!isConvertedContact(customer) && customer.pipelineStage === 'PRESENTATION_DONE') {
      bucket.presentationsCount += 1;
    }
    if (isConvertedContact(customer)) {
      bucket.convertedCount += 1;
    } else if (customer.pipelineStage === 'CLOSED_LOST') {
      bucket.lostCount += 1;
    }
  }

  const rows: Omit<AcquisitionSourceRow, 'rank'>[] = ACQUISITION_SOURCES.map((src) => {
    const bucket = buckets.get(src.code)!;
    return {
      source: src.code,
      label: src.label,
      totalCount: bucket.totalCount,
      activeCount: bucket.activeCount,
      presentationsCount: bucket.presentationsCount,
      convertedCount: bucket.convertedCount,
      lostCount: bucket.lostCount,
      conversionRatePct:
        bucket.totalCount > 0 ? (bucket.convertedCount / bucket.totalCount) * 100 : null,
      shareOfTotalPct: totalInScope > 0 ? (bucket.totalCount / totalInScope) * 100 : null,
    };
  });

  rows.sort((a, b) => {
    const aHasData = a.totalCount > 0 ? 1 : 0;
    const bHasData = b.totalCount > 0 ? 1 : 0;
    if (bHasData !== aHasData) return bHasData - aHasData;
    const rateDiff = (b.conversionRatePct ?? -1) - (a.conversionRatePct ?? -1);
    if (Math.abs(rateDiff) > 1e-9) return rateDiff;
    if (b.convertedCount !== a.convertedCount) return b.convertedCount - a.convertedCount;
    return b.totalCount - a.totalCount;
  });

  let currentRank = 0;
  return rows.map((row) => {
    if (row.totalCount === 0) {
      return { ...row, rank: null };
    }
    currentRank += 1;
    return { ...row, rank: currentRank };
  });
}

/**
 * Répartition de l'entonnoir de conversion par étape du pipeline et détection des prospects stagnants.
 */
export function computeConversionFunnel(
  customers: Customer[],
  period: ProspectionPeriod,
  todayStr: string = localDateISO(),
  stagnationDays = 7,
): ConversionFunnelSummary {
  const scoped = filterCustomersByPeriod(customers, period, todayStr).filter(isProspectionCohortMember);
  const totalInScope = scoped.length;

  const counts: Record<PipelineStage, number> = {
    CONTACT_INITIATED: 0,
    PRESENTATION_DONE: 0,
    FOLLOW_UP_REQUIRED: 0,
    CLOSED_WON: 0,
    CLOSED_LOST: 0,
  };

  for (const customer of scoped) {
    if (isConvertedContact(customer)) {
      counts.CLOSED_WON += 1;
    } else if (customer.pipelineStage in counts) {
      counts[customer.pipelineStage] += 1;
    } else {
      counts.CONTACT_INITIATED += 1;
    }
  }

  const stages: FunnelStageRow[] = PIPELINE_FUNNEL_META.map((meta) => {
    const count = counts[meta.code];
    return {
      stage: meta.code,
      label: meta.label,
      description: meta.description,
      count,
      sharePct: totalInScope > 0 ? (count / totalInScope) * 100 : null,
    };
  });

  const stagnatingProspects: StagnatingProspectInfo[] = scoped
    .filter(isActiveProspect)
    .map((customer) => {
      const last = normalizeDateStr(customer.lastContactDate);
      const days = last ? diffDaysISO(last, todayStr) : null;
      return { customer, daysSinceLastContact: days };
    })
    .filter(
      (entry) => entry.daysSinceLastContact === null || entry.daysSinceLastContact >= stagnationDays,
    )
    .sort((a, b) => {
      if (a.daysSinceLastContact === null && b.daysSinceLastContact === null) {
        return a.customer.name.localeCompare(b.customer.name, 'fr-FR');
      }
      if (a.daysSinceLastContact === null) return -1;
      if (b.daysSinceLastContact === null) return 1;
      return b.daysSinceLastContact - a.daysSinceLastContact;
    });

  return {
    totalInScope,
    stages,
    convertedCount: counts.CLOSED_WON,
    lostCount: counts.CLOSED_LOST,
    conversionRatePct: totalInScope > 0 ? (counts.CLOSED_WON / totalInScope) * 100 : null,
    lossRatePct: totalInScope > 0 ? (counts.CLOSED_LOST / totalInScope) * 100 : null,
    stagnatingProspects,
  };
}

/**
 * Suivi opérationnel des relances basé strictement sur `agendaList`.
 * - Une relance terminée (`completed === true`) n'est JAMAIS comptée en retard.
 * - Une relance en retard est une tâche `FOLLOW_UP` non complétée dont la date est < `todayStr`.
 * - Détecte les prospects actifs sans aucune action ouverte (`FOLLOW_UP` ou `PRESENTATION`) dans l'Agenda.
 */
export function computeFollowUpSummary(
  customers: Customer[],
  agendaList: AgendaItem[],
  todayStr: string = localDateISO(),
): FollowUpSummary {
  const followUps = agendaList
    .filter((item) => item.type === 'FOLLOW_UP')
    .slice()
    .sort((a, b) => {
      const da = normalizeDateStr(a.date);
      const db = normalizeDateStr(b.date);
      if (da !== db) return da.localeCompare(db);
      return (a.time || '').localeCompare(b.time || '');
    });

  const todayItems: EnrichedFollowUpItem[] = [];
  const overdueItems: EnrichedFollowUpItem[] = [];
  const scheduledItems: EnrichedFollowUpItem[] = [];
  const completedItems: EnrichedFollowUpItem[] = [];

  for (const item of followUps) {
    const matchedCustomer = resolveAgendaItemCustomer(item, customers);
    const itemDate = normalizeDateStr(item.date);
    if (item.completed) {
      completedItems.push({ item, matchedCustomer, daysOverdue: 0 });
      continue;
    }
    if (!itemDate) {
      scheduledItems.push({ item, matchedCustomer, daysOverdue: 0 });
      continue;
    }
    if (itemDate < todayStr) {
      const daysOverdue = Math.max(1, diffDaysISO(itemDate, todayStr) ?? 1);
      overdueItems.push({ item, matchedCustomer, daysOverdue });
    } else if (itemDate === todayStr) {
      todayItems.push({ item, matchedCustomer, daysOverdue: 0 });
    } else {
      scheduledItems.push({ item, matchedCustomer, daysOverdue: 0 });
    }
  }

  const openActionItems = agendaList.filter(
    (item) => !item.completed && (item.type === 'FOLLOW_UP' || item.type === 'PRESENTATION'),
  );
  const matchedCustomerIdsWithOpenAction = new Set(
    openActionItems
      .map((item) => resolveAgendaItemCustomer(item, customers)?.id)
      .filter((id): id is string => Boolean(id)),
  );

  const prospectsWithoutNextAction = customers
    .filter(isActiveProspect)
    .filter((prospect) => !matchedCustomerIdsWithOpenAction.has(prospect.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr-FR'));

  return {
    todayCount: todayItems.length,
    overdueCount: overdueItems.length,
    scheduledCount: scheduledItems.length,
    completedCount: completedItems.length,
    withoutNextActionCount: prospectsWithoutNextAction.length,
    todayItems,
    overdueItems,
    scheduledItems,
    completedItems,
    prospectsWithoutNextAction,
  };
}
