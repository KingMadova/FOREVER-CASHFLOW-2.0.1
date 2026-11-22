import { ConversionChannel, Customer, CustomerStatus } from '../types';
import { extractRawErrorMessage } from './actionFeedback';
import {
  CreateProspectInteractionInput,
  getInteractionChannelLabel,
  maxIsoDate,
} from './prospectInteractions';

export type StepPersistenceStatus = 'saved' | 'queued' | 'skipped' | 'failed';

export interface ComposedInteractionParams {
  customerId: string;
  customerName: string;
  customerPhone: string;
  stableInteractionId: string;
  alreadyCommittedInteraction: boolean;
  input: CreateProspectInteractionInput;
  createAgendaFollowUp: boolean;
  addProspectInteraction: (
    customerId: string,
    input: CreateProspectInteractionInput,
  ) => Promise<'saved' | 'queued'>;
  addAgendaItem: (item: {
    id?: string;
    title: string;
    date: string;
    time: string;
    type: 'FOLLOW_UP';
    customerId: string;
    contactName: string;
    contactPhone: string;
    notes?: string;
  }) => Promise<'saved' | 'queued'>;
}

export interface ComposedInteractionResult {
  interactionStatus: 'saved' | 'queued';
  agendaStatus: StepPersistenceStatus;
  interactionId: string;
  agendaError?: string;
  overallPersistence: 'saved' | 'queued';
  hasPartialAgendaFailure: boolean;
}

/**
 * Orchestre de manière idempotente l'enregistrement d'une interaction prospect
 * et, optionnellement, la création d'une tâche de relance Agenda.
 * - Garantit que l'échec de la relance Agenda ne fait jamais re-soumettre ni oublier
 *   une interaction déjà enregistrée sur Firestore ou mise en file hors-ligne.
 */
export async function executeComposedInteractionWithFollowUp(
  params: ComposedInteractionParams,
): Promise<ComposedInteractionResult> {
  const {
    customerId,
    customerName,
    customerPhone,
    stableInteractionId,
    alreadyCommittedInteraction,
    input,
    createAgendaFollowUp,
    addProspectInteraction,
    addAgendaItem,
  } = params;

  let interactionStatus: 'saved' | 'queued' = 'saved';
  if (!alreadyCommittedInteraction) {
    interactionStatus = await addProspectInteraction(customerId, {
      ...input,
      id: stableInteractionId,
    });
  }

  let agendaStatus: StepPersistenceStatus = 'skipped';
  let agendaError: string | undefined;

  if (createAgendaFollowUp && input.nextFollowUpDate) {
    try {
      agendaStatus = await addAgendaItem({
        id: `ag_rel_${stableInteractionId}`,
        title: `Relancer ${customerName} (${getInteractionChannelLabel(input.channel)})`,
        date: input.nextFollowUpDate,
        time: '10:00',
        type: 'FOLLOW_UP',
        customerId,
        contactName: customerName,
        contactPhone: customerPhone,
        notes: input.notes?.trim() || undefined,
      });
    } catch (err) {
      agendaStatus = 'failed';
      agendaError = extractRawErrorMessage(err) || "Impossible d'ajouter la relance dans l'Agenda.";
    }
  }

  return {
    interactionStatus,
    agendaStatus,
    interactionId: stableInteractionId,
    agendaError,
    overallPersistence:
      interactionStatus === 'queued' || agendaStatus === 'queued' ? 'queued' : 'saved',
    hasPartialAgendaFailure: agendaStatus === 'failed',
  };
}

export function buildConversionInteractionId(
  prospectId: string,
  convertedAt: string,
  conversionChannel: ConversionChannel,
): string {
  return `int_conv_${prospectId}_${convertedAt}_${conversionChannel}`;
}

export function hasRecordedConversionInteraction(
  prospect: Pick<Customer, 'interactions'>,
  conversionChannel: ConversionChannel,
  convertedAt: string,
  deterministicId: string,
): boolean {
  return (prospect.interactions || []).some(
    (i) =>
      i.id === deterministicId ||
      (i.outcome === 'CONVERTI' &&
        i.channel === conversionChannel &&
        i.date === convertedAt),
  );
}

export interface ComposedConversionParams {
  prospect: Customer;
  conversionChannel: ConversionChannel;
  convertedAt: string;
  logConversionInteraction: boolean;
  addProspectInteraction: (
    customerId: string,
    input: CreateProspectInteractionInput,
  ) => Promise<'saved' | 'queued'>;
  updateCustomer: (customer: Customer) => Promise<'saved' | 'queued'>;
}

export interface ComposedConversionResult {
  interactionStatus: StepPersistenceStatus;
  conversionStatus: 'saved' | 'queued';
  overallPersistence: 'saved' | 'queued';
  conversionInteractionId?: string;
}

/**
 * Orchestre la conversion d'un prospect en client avec idempotence sur l'interaction CONVERTI :
 * - Utilise un identifiant déterministe par (prospectId, convertedAt, conversionChannel).
 * - Ne recrée jamais d'interaction CONVERTI si elle existe déjà en local, en file ou sur Firestore.
 * - Si updateCustomer échoue, préserve l'interaction éventuellement créée/mise en file et permet
 *   une reprise ultérieure sans doublon.
 */
export async function executeComposedProspectConversion(
  params: ComposedConversionParams,
): Promise<ComposedConversionResult> {
  const {
    prospect,
    conversionChannel,
    convertedAt,
    logConversionInteraction,
    addProspectInteraction,
    updateCustomer,
  } = params;

  const monotonicLast = maxIsoDate(prospect.lastContactDate, convertedAt) || convertedAt;
  let interactionStatus: StepPersistenceStatus = 'skipped';
  let conversionInteractionId: string | undefined;

  if (logConversionInteraction && conversionChannel !== 'INCONNU') {
    const deterministicId = buildConversionInteractionId(
      prospect.id,
      convertedAt,
      conversionChannel,
    );
    conversionInteractionId = deterministicId;

    const alreadyPresent = hasRecordedConversionInteraction(
      prospect,
      conversionChannel,
      convertedAt,
      deterministicId,
    );

    if (!alreadyPresent) {
      interactionStatus = await addProspectInteraction(prospect.id, {
        id: deterministicId,
        date: convertedAt,
        channel: conversionChannel,
        actionType: 'RELANCE',
        outcome: 'CONVERTI',
        notes: 'Interaction de conversion enregistrée lors du passage en Client FLP.',
      });
    }
  }

  const conversionStatus = await updateCustomer({
    ...prospect,
    recordOrigin: prospect.recordOrigin ?? 'PROSPECTION',
    convertedFromProspect: true,
    convertedAt,
    conversionChannel,
    status: CustomerStatus.CLIENT,
    pipelineStage: 'CLOSED_WON',
    lastContactDate: monotonicLast,
  });

  return {
    interactionStatus,
    conversionStatus,
    overallPersistence:
      interactionStatus === 'queued' || conversionStatus === 'queued' ? 'queued' : 'saved',
    conversionInteractionId,
  };
}
