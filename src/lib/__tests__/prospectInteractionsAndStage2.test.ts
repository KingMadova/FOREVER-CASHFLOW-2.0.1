import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildProspectInteraction,
  getEffectiveLastContactDate,
  isResponseOutcome,
  isValidCalendarIsoDate,
  maxIsoDate,
  mergeInteractionsUnique,
  normalizeValidIsoDate,
  sanitizeInteractionForFirestore,
  stripInteractionsFromCustomerUpdatePayload,
} from '../prospectInteractions';
import {
  computeChannelPerformanceStats,
  computeProspectionOverviewKpis,
} from '../prospectionStats';
import {
  SyncTask,
  classifySyncError,
  clearTaskErrorAndUnblockDependents,
  createSerializedSyncRunner,
  dismissTaskWithDependents,
  executeSyncQueueBatch,
  isTaskEligibleForAutoSync,
  markTaskRetryFailure,
  orderSyncTasksForExecution,
  recomputeCustomerAfterDismissedInteraction,
  reconcileCustomersWithSyncQueue,
  removeAllTasksForCustomer,
  upsertEntityTaskInQueue,
} from '../syncQueueHelpers';
import {
  buildConversionInteractionId,
  executeComposedInteractionWithFollowUp,
  executeComposedProspectConversion,
  hasRecordedConversionInteraction,
} from '../composedOperations';
import { clearAllActionLocksForTest, runFeedbackAction } from '../actionFeedback';
import { Customer, CustomerStatus, ProspectInteraction } from '../../types';

function makeCustomer(overrides: Partial<Customer> & { id: string; name: string }): Customer {
  return {
    email: 'prospect@example.com',
    phone: '0600000000',
    status: CustomerStatus.PROSPECT,
    pipelineStage: 'CONTACT_INITIATED',
    lastContactDate: '2026-11-10',
    createdAt: '2026-11-10T10:00:00.000Z',
    recordOrigin: 'PROSPECTION',
    ...overrides,
  };
}

test('Validation stricte des dates calendaires et non-régression de lastContactDate (maxIsoDate)', () => {
  assert.equal(isValidCalendarIsoDate('2026-11-22'), true);
  assert.equal(isValidCalendarIsoDate('2024-02-29'), true); // année bissextile
  assert.equal(normalizeValidIsoDate('2026-11-22T15:45:00.000Z'), '2026-11-22');

  // Dates calendaires impossibles ou malformées rejetées
  assert.equal(isValidCalendarIsoDate('2026-02-30'), false);
  assert.equal(isValidCalendarIsoDate('2026-02-29'), false); // 2026 non bissextile
  assert.equal(isValidCalendarIsoDate('2026-13-01'), false);
  assert.equal(isValidCalendarIsoDate('2026-00-10'), false);
  assert.equal(isValidCalendarIsoDate('2026-04-31'), false);
  assert.equal(isValidCalendarIsoDate('invalid-date'), false);
  assert.equal(isValidCalendarIsoDate(''), false);
  assert.equal(isValidCalendarIsoDate(undefined), false);

  // maxIsoDate ignore les dates invalides et ne régresse jamais
  assert.equal(
    maxIsoDate('2026-11-20', '2026-02-30', '2026-11-15', '2026-13-01', 'bad'),
    '2026-11-20',
  );
  assert.equal(maxIsoDate('2026-11-15', '2026-11-22'), '2026-11-22');
  assert.equal(maxIsoDate('2026-02-30', undefined, ''), '');

  // getEffectiveLastContactDate prend le maximum entre lastContactDate et les interactions valides
  const effective = getEffectiveLastContactDate({
    lastContactDate: '2026-11-18',
    interactions: [
      buildProspectInteraction(
        {
          id: 'i1',
          date: '2026-11-10',
          channel: 'SMS',
          actionType: 'PREMIER_CONTACT',
          outcome: 'SANS_REPONSE',
        },
        '2026-11-10T09:00:00.000Z',
      ),
      buildProspectInteraction(
        {
          id: 'i2',
          date: '2026-11-21',
          channel: 'WHATSAPP',
          actionType: 'RELANCE',
          outcome: 'INTERESSE',
        },
        '2026-11-21T09:00:00.000Z',
      ),
    ],
  });
  assert.equal(effective, '2026-11-21');
});

test('Construction, sanitisation (zéro undefined), déduplication et protection anti-écrasement des interactions', () => {
  assert.throws(
    () =>
      buildProspectInteraction({
        date: '2026-02-30',
        channel: 'WHATSAPP',
        actionType: 'PREMIER_CONTACT',
        outcome: 'SANS_REPONSE',
      }),
    /date/i,
  );
  assert.throws(
    () =>
      buildProspectInteraction({
        date: '2026-11-20',
        channel: 'WHATSAPP',
        actionType: 'RELANCE',
        outcome: 'SANS_REPONSE',
        nextFollowUpDate: '2026-13-40',
      }),
    /prochaine relance/i,
  );

  const built = buildProspectInteraction(
    {
      id: 'int_fixed_1',
      date: '2026-11-20',
      channel: 'WHATSAPP',
      actionType: 'RELANCE',
      outcome: 'INTERESSE',
      notes: '   ',
    },
    '2026-11-20T12:00:00.000Z',
  );
  assert.equal('notes' in built, false);
  assert.equal('nextFollowUpDate' in built, false);
  assert.deepEqual(sanitizeInteractionForFirestore(built), built);

  const dupMerged = mergeInteractionsUnique(
    [built],
    [
      built,
      buildProspectInteraction(
        {
          id: 'int_earlier',
          date: '2026-11-18',
          channel: 'APPEL',
          actionType: 'PREMIER_CONTACT',
          outcome: 'SANS_REPONSE',
        },
        '2026-11-18T10:00:00.000Z',
      ),
    ],
  );
  assert.equal(dupMerged.length, 2);
  assert.equal(dupMerged[0].id, 'int_earlier');
  assert.equal(dupMerged[1].id, 'int_fixed_1');

  const rawPayload = {
    name: 'Nom modifié',
    lastContactDate: '2026-11-22',
    interactions: [built],
  };
  const stripped = stripInteractionsFromCustomerUpdatePayload(rawPayload);
  assert.equal('interactions' in stripped, false);
  assert.equal(stripped.name, 'Nom modifié');
  assert.equal(Array.isArray(rawPayload.interactions), true);
});

test('Formules officielles des statistiques par canal et séparation cohorte createdAt vs convertedAt', () => {
  assert.equal(isResponseOutcome('SANS_REPONSE'), false);
  assert.equal(isResponseOutcome('INTERESSE'), true);
  assert.equal(isResponseOutcome('REFUS'), true);
  assert.equal(isResponseOutcome('PRESENTATION_PROGRAMMEE'), true);
  assert.equal(isResponseOutcome('CONVERTI'), true);

  const i1 = buildProspectInteraction(
    { id: 'w1', date: '2026-11-11', channel: 'WHATSAPP', actionType: 'PREMIER_CONTACT', outcome: 'SANS_REPONSE' },
    '2026-11-11T10:00:00.000Z',
  );
  const i2 = buildProspectInteraction(
    { id: 'w2', date: '2026-11-12', channel: 'WHATSAPP', actionType: 'RELANCE', outcome: 'INTERESSE' },
    '2026-11-12T10:00:00.000Z',
  );
  const i3 = buildProspectInteraction(
    { id: 'w3', date: '2026-11-13', channel: 'WHATSAPP', actionType: 'RELANCE', outcome: 'CONVERTI' },
    '2026-11-13T10:00:00.000Z',
  );
  const i4 = buildProspectInteraction(
    { id: 's1', date: '2026-11-14', channel: 'SMS', actionType: 'PREMIER_CONTACT', outcome: 'SANS_REPONSE' },
    '2026-11-14T10:00:00.000Z',
  );
  const i5 = buildProspectInteraction(
    { id: 'w4', date: '2026-11-15', channel: 'WHATSAPP', actionType: 'PREMIER_CONTACT', outcome: 'REFUS' },
    '2026-11-15T10:00:00.000Z',
  );

  const customers: Customer[] = [
    // P1 : 3 interactions WHATSAPP (unicité prospect = 1 contacté, 1 répondu, 1 converti sur WHATSAPP)
    makeCustomer({
      id: 'p1',
      name: 'Prospect Converti WhatsApp',
      status: CustomerStatus.CLIENT,
      pipelineStage: 'CLOSED_WON',
      convertedFromProspect: true,
      convertedAt: '2026-11-13',
      conversionChannel: 'WHATSAPP',
      createdAt: '2026-11-10T08:00:00.000Z',
      interactions: [i1, i2, i3],
    }),
    // P2 : contacté sur WHATSAPP (REFUS = réponse), pas converti
    makeCustomer({
      id: 'p2',
      name: 'Prospect Refus WhatsApp',
      status: CustomerStatus.PROSPECT,
      pipelineStage: 'CLOSED_LOST',
      createdAt: '2026-11-11T08:00:00.000Z',
      interactions: [i5],
    }),
    // P3 : contacté sur SMS (SANS_REPONSE), converti avec canal APPEL sans interaction APPEL
    // -> ne doit JAMAIS gonfler le taux de conversion APPEL (reste 0/0 = null) ni dépasser 100 %
    makeCustomer({
      id: 'p3',
      name: 'Prospect Converti Incohérent',
      status: CustomerStatus.CLIENT,
      pipelineStage: 'CLOSED_WON',
      convertedFromProspect: true,
      convertedAt: '2026-11-18',
      conversionChannel: 'APPEL',
      createdAt: '2026-11-12T08:00:00.000Z',
      interactions: [i4],
    }),
    // P4 : converti sur canal INCONNU sans interaction
    makeCustomer({
      id: 'p4',
      name: 'Prospect Converti Inconnu',
      status: CustomerStatus.CLIENT,
      pipelineStage: 'CLOSED_WON',
      convertedFromProspect: true,
      convertedAt: '2026-11-19',
      conversionChannel: 'INCONNU',
      createdAt: '2026-11-12T09:00:00.000Z',
    }),
    // P5 : ancien prospect créé en octobre (hors période '30' si todayStr=2026-12-05) mais converti en novembre
    makeCustomer({
      id: 'p5',
      name: 'Prospect Octobre Converti Novembre',
      status: CustomerStatus.CLIENT,
      pipelineStage: 'CLOSED_WON',
      convertedFromProspect: true,
      convertedAt: '2026-11-25',
      conversionChannel: 'INCONNU',
      createdAt: '2026-10-05T09:00:00.000Z',
    }),
    // Client direct (DOIT être exclu des stats prospection même s'il a une interaction)
    makeCustomer({
      id: 'direct_1',
      name: 'Client Direct',
      status: CustomerStatus.CLIENT,
      pipelineStage: 'CLOSED_WON',
      recordOrigin: 'DIRECT_CLIENT',
      createdAt: '2026-11-12T10:00:00.000Z',
      interactions: [i2],
    }),
    // Ancien client historique non attribuable (DOIT être exclu de la cohorte)
    makeCustomer({
      id: 'hist_1',
      name: 'Client Historique',
      status: CustomerStatus.CLIENT,
      pipelineStage: 'CLOSED_WON',
      recordOrigin: undefined,
      convertedFromProspect: undefined,
      createdAt: '2026-11-12T10:00:00.000Z',
    }),
  ];

  const statsAll = computeChannelPerformanceStats(customers, 'all', '2026-11-30');
  assert.equal(statsAll.totalCohortProspects, 5);
  assert.equal(statsAll.totalContactedWithInteractions, 3);
  assert.equal(statsAll.unknownChannelConversionsCount, 2);
  assert.equal(statsAll.attributedWithoutChannelInteractionCount, 1);

  const whatsapp = statsAll.rows.find((r) => r.channel === 'WHATSAPP')!;
  assert.equal(whatsapp.contactedProspectsCount, 2); // P1 + P2 (direct_1 exclu)
  assert.equal(whatsapp.interactionsCount, 4); // i1, i2, i3, i5
  assert.equal(whatsapp.respondedProspectsCount, 2); // P1 (INTERESSE/CONVERTI) + P2 (REFUS)
  assert.equal(whatsapp.convertedProspectsCount, 1); // P1 uniquement
  assert.equal(whatsapp.responseRatePct, 100);
  assert.equal(whatsapp.conversionRatePct, 50);
  assert.equal(whatsapp.rank, 1);

  const sms = statsAll.rows.find((r) => r.channel === 'SMS')!;
  assert.equal(sms.contactedProspectsCount, 1); // P3
  assert.equal(sms.respondedProspectsCount, 0); // SANS_REPONSE ne compte pas
  assert.equal(sms.convertedProspectsCount, 0);
  assert.equal(sms.responseRatePct, 0);
  assert.equal(sms.conversionRatePct, 0);
  assert.equal(sms.rank, 2);

  // APPEL n'a aucune interaction enregistrée -> "Données insuffisantes" (null), jamais 0 % ni >100 %
  const appel = statsAll.rows.find((r) => r.channel === 'APPEL')!;
  assert.equal(appel.contactedProspectsCount, 0);
  assert.equal(appel.responseRatePct, null);
  assert.equal(appel.conversionRatePct, null);
  assert.equal(appel.rank, null);

  // Séparation stricte cohorte createdAt vs date réelle convertedAt sur les 30 derniers jours
  // today = 2026-11-30 => fenêtre '30' = 2026-11-01 .. 2026-11-30
  const kpis30 = computeProspectionOverviewKpis(customers, [], '30', '2026-11-30');
  assert.equal(kpis30.totalProspects, 4); // P1, P2, P3, P4 (P5 créé en octobre est hors cohorte)
  assert.equal(kpis30.convertedCount, 3); // P1, P3, P4
  assert.equal(kpis30.conversionsInPeriodByConvertedAtCount, 4); // P1, P3, P4, P5 convertis en novembre !
  assert.equal(kpis30.interactionContactedCount, 3); // P1, P2, P3
  assert.equal(kpis30.respondedCount, 2); // P1, P2
  assert.ok(Math.abs((kpis30.responseRatePct ?? 0) - (2 / 3) * 100) < 1e-9);
  assert.equal(kpis30.unattributedHistoricalClientsCount, 1);
});

test('syncQueue CUSTOMER_INTERACTION : indépendance multi-interactions, déduplication idempotente, stripping UPDATE et purge DELETE', () => {
  const int1 = buildProspectInteraction(
    { id: 'int_1', date: '2026-11-20', channel: 'WHATSAPP', actionType: 'PREMIER_CONTACT', outcome: 'SANS_REPONSE' },
    '2026-11-20T09:00:00.000Z',
  );
  const int2 = buildProspectInteraction(
    { id: 'int_2', date: '2026-11-21', channel: 'APPEL', actionType: 'RELANCE', outcome: 'INTERESSE' },
    '2026-11-21T10:00:00.000Z',
  );

  let queue: SyncTask[] = [];
  queue = upsertEntityTaskInQueue(queue, {
    id: 'sync_i1',
    type: 'CUSTOMER_INTERACTION',
    entityId: int1.id,
    name: 'Interaction Alice',
    actionType: 'ADD',
    payload: { customerId: 'cust_1', interaction: int1 },
    createdAt: '2026-11-20T09:00:00.000Z',
  });
  queue = upsertEntityTaskInQueue(queue, {
    id: 'sync_i2',
    type: 'CUSTOMER_INTERACTION',
    entityId: int2.id,
    name: 'Interaction Alice',
    actionType: 'ADD',
    payload: { customerId: 'cust_1', interaction: int2 },
    createdAt: '2026-11-21T10:00:00.000Z',
  });
  // Soumission en double du même interaction.id -> reste idempotent
  queue = upsertEntityTaskInQueue(queue, {
    id: 'sync_i2_dup',
    type: 'CUSTOMER_INTERACTION',
    entityId: int2.id,
    name: 'Interaction Alice',
    actionType: 'ADD',
    payload: { customerId: 'cust_1', interaction: int2 },
    createdAt: '2026-11-21T10:01:00.000Z',
  });

  assert.equal(queue.filter((t) => t.type === 'CUSTOMER_INTERACTION').length, 2);

  // CUSTOMER UPDATE retire strictement `interactions` et applique maxIsoDate
  queue = upsertEntityTaskInQueue(queue, {
    id: 'sync_u1',
    type: 'CUSTOMER',
    entityId: 'cust_1',
    name: 'Alice',
    actionType: 'UPDATE',
    payload: { notes: 'Maj 1', lastContactDate: '2026-11-22', interactions: [int1] },
    createdAt: '2026-11-22T08:00:00.000Z',
  });
  queue = upsertEntityTaskInQueue(queue, {
    id: 'sync_u2',
    type: 'CUSTOMER',
    entityId: 'cust_1',
    name: 'Alice',
    actionType: 'UPDATE',
    payload: { notes: 'Maj 2', lastContactDate: '2026-11-15', interactions: [] },
    createdAt: '2026-11-22T08:05:00.000Z',
  });
  const updateTask = queue.find((t) => t.type === 'CUSTOMER' && t.actionType === 'UPDATE')!;
  assert.equal('interactions' in updateTask.payload, false);
  assert.equal(updateTask.payload.lastContactDate, '2026-11-22'); // jamais régressé à 2026-11-15

  // Ordonnancement : ADD avant UPDATE avant CUSTOMER_INTERACTION
  queue = upsertEntityTaskInQueue(queue, {
    id: 'sync_add_other',
    type: 'CUSTOMER',
    entityId: 'cust_2',
    name: 'Bob',
    actionType: 'ADD',
    payload: { name: 'Bob' },
    createdAt: '2026-11-22T09:00:00.000Z',
  });
  const ordered = orderSyncTasksForExecution(queue);
  assert.equal(ordered[0].type, 'CUSTOMER');
  assert.equal(ordered[0].actionType, 'ADD');
  assert.equal(ordered[1].actionType, 'UPDATE');
  assert.equal(ordered[2].type, 'CUSTOMER_INTERACTION');
  assert.equal(ordered[3].type, 'CUSTOMER_INTERACTION');

  // CUSTOMER DELETE purge toutes les CUSTOMER_INTERACTION en attente de ce prospect
  queue = upsertEntityTaskInQueue(queue, {
    id: 'sync_del_1',
    type: 'CUSTOMER',
    entityId: 'cust_1',
    name: 'Alice',
    actionType: 'DELETE',
    payload: {},
    createdAt: '2026-11-22T10:00:00.000Z',
  });
  assert.equal(queue.some((t) => t.type === 'CUSTOMER_INTERACTION' && t.payload.customerId === 'cust_1'), false);
  assert.equal(queue.some((t) => t.type === 'CUSTOMER' && t.entityId === 'cust_1' && t.actionType === 'DELETE'), true);
});

test('Classification erreurs réseau vs définitives et reprise déterministe sans doublon', async () => {
  assert.equal(classifySyncError({ code: 'unavailable', message: 'network down' }), 'RETRYABLE');
  assert.equal(classifySyncError(new Error('Failed to fetch'), { isOnline: true }), 'RETRYABLE');
  assert.equal(classifySyncError({ code: 'permission-denied', message: 'Denied' }), 'PERMANENT');
  assert.equal(classifySyncError({ code: 'invalid-argument', message: 'Bad field' }), 'PERMANENT');
  assert.equal(
    classifySyncError({ code: 'not-found', message: 'No doc' }, { hasPendingParentAdd: true }),
    'RETRYABLE',
  );
  assert.equal(
    classifySyncError({ code: 'not-found', message: 'No doc' }, { hasPendingParentAdd: false }),
    'PERMANENT',
  );

  const interaction = buildProspectInteraction(
    {
      id: 'int_replay_1',
      date: '2026-11-22',
      channel: 'WHATSAPP',
      actionType: 'RELANCE',
      outcome: 'PRESENTATION_PROGRAMMEE',
      notes: 'Note exacte figée',
    },
    '2026-11-22T11:00:00.000Z',
  );

  let queue: SyncTask[] = [
    {
      id: 'task_int_replay',
      type: 'CUSTOMER_INTERACTION',
      entityId: interaction.id,
      name: 'Interaction Replay',
      actionType: 'ADD',
      payload: { customerId: 'cust_existing', interaction },
      createdAt: '2026-11-22T11:00:00.000Z',
    },
  ];

  const submittedPayloads: ProspectInteraction[] = [];
  let attempt = 0;

  // Passe 1 : erreur réseau transitoire -> tâche conservée intacte et rejouable
  const summary1 = await executeSyncQueueBatch({
    getQueue: () => queue,
    setQueue: (updater) => {
      queue = updater(queue);
    },
    isOffline: () => false,
    executeTask: async (task) => {
      attempt += 1;
      submittedPayloads.push(task.payload.interaction);
      if (attempt === 1) {
        const err = new Error('Network timeout') as Error & { code?: string };
        err.code = 'unavailable';
        throw err;
      }
    },
    nowIso: () => '2026-11-22T11:05:00.000Z',
  });

  assert.equal(summary1.retryableFailedCount, 1);
  assert.equal(summary1.permanentFailedCount, 0);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].permanentError, false);
  assert.equal(queue[0].retryCount, 1);

  // Passe 2 : reprise réussie avec payload strictement identique au premier envoi
  const summary2 = await executeSyncQueueBatch({
    getQueue: () => queue,
    setQueue: (updater) => {
      queue = updater(queue);
    },
    isOffline: () => false,
    executeTask: async (task) => {
      attempt += 1;
      submittedPayloads.push(task.payload.interaction);
    },
  });

  assert.equal(summary2.syncedCount, 1);
  assert.equal(queue.length, 0);
  assert.equal(submittedPayloads.length, 2);
  assert.deepEqual(submittedPayloads[0], submittedPayloads[1]);
});

test('Dépendance CUSTOMER ADD -> CUSTOMER_INTERACTION : report transitoire, blocage explicite si permanent, réessai et suppression', async () => {
  const int1 = buildProspectInteraction(
    { id: 'int_dep_1', date: '2026-11-22', channel: 'APPEL', actionType: 'PREMIER_CONTACT', outcome: 'INTERESSE' },
    '2026-11-22T10:00:00.000Z',
  );

  // 1) Échec transitoire de CUSTOMER ADD -> interaction différée sans appel Firestore
  let queueTransient: SyncTask[] = [
    {
      id: 'task_int_first_in_array',
      type: 'CUSTOMER_INTERACTION',
      entityId: int1.id,
      name: 'Interaction Prospect Offline',
      actionType: 'ADD',
      payload: { customerId: 'cust_new_1', interaction: int1 },
      createdAt: '2026-11-22T10:00:00.000Z',
    },
    {
      id: 'task_add_1',
      type: 'CUSTOMER',
      entityId: 'cust_new_1',
      name: 'Nouveau Prospect',
      actionType: 'ADD',
      payload: { name: 'Nouveau Prospect', phone: '0611111111' },
      createdAt: '2026-11-22T09:59:00.000Z',
    },
  ];

  const executedIdsTransient: string[] = [];
  const resTransient = await executeSyncQueueBatch({
    getQueue: () => queueTransient,
    setQueue: (u) => {
      queueTransient = u(queueTransient);
    },
    isOffline: () => false,
    executeTask: async (task) => {
      executedIdsTransient.push(task.id);
      if (task.id === 'task_add_1') {
        const err = new Error('Client is offline') as Error & { code?: string };
        err.code = 'unavailable';
        throw err;
      }
    },
  });

  assert.deepEqual(executedIdsTransient, ['task_add_1']);
  assert.equal(resTransient.retryableFailedCount, 1);
  assert.equal(resTransient.deferredCount, 1);
  assert.equal(queueTransient.find((t) => t.id === 'task_int_first_in_array')?.blockedByTaskId, undefined);

  // 2) Échec permanent de CUSTOMER ADD -> interaction marquée explicitement bloquée (blockedByTaskId + blockedReason)
  let queuePerm: SyncTask[] = [
    {
      id: 'task_add_perm',
      type: 'CUSTOMER',
      entityId: 'cust_new_2',
      name: 'Prospect Invalide',
      actionType: 'ADD',
      payload: { name: 'Prospect Invalide' },
      createdAt: '2026-11-22T09:59:00.000Z',
    },
    {
      id: 'task_int_blocked',
      type: 'CUSTOMER_INTERACTION',
      entityId: 'int_dep_2',
      name: 'Interaction Bloquée',
      actionType: 'ADD',
      payload: { customerId: 'cust_new_2', interaction: { ...int1, id: 'int_dep_2' } },
      createdAt: '2026-11-22T10:00:00.000Z',
    },
  ];

  const executedIdsPerm: string[] = [];
  const resPerm = await executeSyncQueueBatch({
    getQueue: () => queuePerm,
    setQueue: (u) => {
      queuePerm = u(queuePerm);
    },
    isOffline: () => false,
    executeTask: async (task) => {
      executedIdsPerm.push(task.id);
      if (task.id === 'task_add_perm') {
        const err = new Error('Missing or insufficient permissions.') as Error & { code?: string };
        err.code = 'permission-denied';
        throw err;
      }
    },
  });

  assert.deepEqual(executedIdsPerm, ['task_add_perm']);
  assert.equal(resPerm.permanentFailedCount, 1);
  assert.equal(resPerm.blockedByParentCount, 1);

  const failedAdd = queuePerm.find((t) => t.id === 'task_add_perm')!;
  const blockedInt = queuePerm.find((t) => t.id === 'task_int_blocked')!;
  assert.equal(failedAdd.permanentError, true);
  assert.equal(blockedInt.blockedByTaskId, 'task_add_perm');
  assert.match(blockedInt.blockedReason || '', /Prospect Invalide/);

  // Même si la tâche d'interaction seule était passée dans markTaskRetryFailure, elle est bloquée
  const blockedDirectly = markTaskRetryFailure(
    [
      { ...failedAdd, permanentError: false },
      { ...blockedInt, blockedByTaskId: undefined, blockedReason: undefined },
    ],
    'task_add_perm',
    'Invalid payload',
    'PERMANENT',
  );
  assert.equal(blockedDirectly[1].blockedByTaskId, 'task_add_perm');

  // Une passe automatique suivante ne tente ni l'ADD permanent ni l'interaction bloquée
  const executedOnNextPass: string[] = [];
  const resSkip = await executeSyncQueueBatch({
    getQueue: () => queuePerm,
    setQueue: (u) => {
      queuePerm = u(queuePerm);
    },
    isOffline: () => false,
    executeTask: async (task) => {
      executedOnNextPass.push(task.id);
    },
  });
  assert.deepEqual(executedOnNextPass, []);
  assert.equal(resSkip.syncedCount, 0);

  // Action "Ignorer" sur une copie supprime ADD + interaction bloquée
  const dismissed = dismissTaskWithDependents(queuePerm, 'task_add_perm');
  assert.equal(dismissed.length, 0);

  // Action "Réessayer" débloque les deux et permet la synchronisation complète
  let retriedQueue = clearTaskErrorAndUnblockDependents(queuePerm, 'task_add_perm');
  assert.equal(retriedQueue[0].permanentError, undefined);
  assert.equal(retriedQueue[1].blockedByTaskId, undefined);

  const resRetrySuccess = await executeSyncQueueBatch({
    getQueue: () => retriedQueue,
    setQueue: (u) => {
      retriedQueue = u(retriedQueue);
    },
    isOffline: () => false,
    executeTask: async () => {},
  });
  assert.equal(resRetrySuccess.syncedCount, 2);
  assert.equal(retriedQueue.length, 0);
});

test('Réconciliation après rechargement et protection multi-appareils sur lastContactDate et interactions', () => {
  const remoteInt = buildProspectInteraction(
    { id: 'int_remote', date: '2026-11-19', channel: 'WHATSAPP', actionType: 'PREMIER_CONTACT', outcome: 'INTERESSE' },
    '2026-11-19T10:00:00.000Z',
  );
  const localOlderInt = buildProspectInteraction(
    { id: 'int_local_older', date: '2026-11-15', channel: 'SMS', actionType: 'PREMIER_CONTACT', outcome: 'SANS_REPONSE' },
    '2026-11-15T09:00:00.000Z',
  );
  const localNewerInt = buildProspectInteraction(
    { id: 'int_local_newer', date: '2026-11-22', channel: 'APPEL', actionType: 'RELANCE', outcome: 'PRESENTATION_PROGRAMMEE' },
    '2026-11-22T14:00:00.000Z',
  );

  const firestoreCustomers: Customer[] = [
    makeCustomer({
      id: 'cust_remote',
      name: 'Prospect Distant',
      lastContactDate: '2026-11-19',
      interactions: [remoteInt],
      synced: true,
    }),
    makeCustomer({
      id: 'cust_deleted_offline',
      name: 'Supprimé Hors-ligne',
      synced: true,
    }),
  ];

  const syncQueue: SyncTask[] = [
    // Prospect créé hors-ligne pas encore dans Firestore
    {
      id: 'q1',
      type: 'CUSTOMER',
      entityId: 'cust_offline_new',
      name: 'Prospect Offline',
      actionType: 'ADD',
      payload: makeCustomer({
        id: 'cust_offline_new',
        name: 'Prospect Offline',
        lastContactDate: '2026-11-20',
      }),
      createdAt: '2026-11-20T10:00:00.000Z',
    },
    // Interaction ajoutée hors-ligne sur ce nouveau prospect
    {
      id: 'q2',
      type: 'CUSTOMER_INTERACTION',
      entityId: localNewerInt.id,
      name: 'Interaction Prospect Offline',
      actionType: 'ADD',
      payload: { customerId: 'cust_offline_new', interaction: localNewerInt },
      createdAt: '2026-11-22T14:00:00.000Z',
    },
    // Interaction plus ancienne en attente sur cust_remote : NE DOIT PAS faire régresser lastContactDate
    {
      id: 'q3',
      type: 'CUSTOMER_INTERACTION',
      entityId: localOlderInt.id,
      name: 'Ancienne interaction',
      actionType: 'ADD',
      payload: { customerId: 'cust_remote', interaction: localOlderInt },
      createdAt: '2026-11-15T09:00:00.000Z',
    },
    // Doublon d'une interaction déjà reçue de Firestore -> ne doit pas être dupliquée
    {
      id: 'q4',
      type: 'CUSTOMER_INTERACTION',
      entityId: remoteInt.id,
      name: 'Doublon distant',
      actionType: 'ADD',
      payload: { customerId: 'cust_remote', interaction: remoteInt },
      createdAt: '2026-11-19T10:00:00.000Z',
    },
    // CUSTOMER UPDATE ne contenant pas interactions (ou avec tentative d'écrasement) : préserve interactions
    {
      id: 'q5',
      type: 'CUSTOMER',
      entityId: 'cust_remote',
      name: 'Prospect Distant',
      actionType: 'UPDATE',
      payload: { notes: 'Note locale', lastContactDate: '2026-11-10', interactions: [] },
      createdAt: '2026-11-22T15:00:00.000Z',
    },
    // Suppression hors-ligne
    {
      id: 'q6',
      type: 'CUSTOMER',
      entityId: 'cust_deleted_offline',
      name: 'Supprimé Hors-ligne',
      actionType: 'DELETE',
      payload: {},
      createdAt: '2026-11-22T16:00:00.000Z',
    },
  ];

  const reconciled = reconcileCustomersWithSyncQueue(firestoreCustomers, syncQueue);
  assert.equal(reconciled.length, 2);
  assert.equal(reconciled.some((c) => c.id === 'cust_deleted_offline'), false);

  const offlineNew = reconciled.find((c) => c.id === 'cust_offline_new')!;
  assert.equal(offlineNew.synced, false);
  assert.equal(offlineNew.interactions?.length, 1);
  assert.equal(offlineNew.lastContactDate, '2026-11-22');

  const remote = reconciled.find((c) => c.id === 'cust_remote')!;
  assert.equal(remote.synced, false);
  assert.equal(remote.notes, 'Note locale');
  assert.equal(remote.interactions?.length, 2); // int_local_older + int_remote (pas de doublon)
  assert.equal(remote.lastContactDate, '2026-11-19'); // jamais régressé par 2026-11-15 ou 2026-11-10
});

test('Durcissement 1a — Suppression en ligne réussie purge CUSTOMER ADD, UPDATE et CUSTOMER_INTERACTION sans toucher aux autres prospects', () => {
  const int1 = buildProspectInteraction(
    { id: 'int_del_1', date: '2026-11-22', channel: 'WHATSAPP', actionType: 'RELANCE', outcome: 'INTERESSE' },
    '2026-11-22T10:00:00.000Z',
  );
  const intOther = buildProspectInteraction(
    { id: 'int_other_1', date: '2026-11-22', channel: 'SMS', actionType: 'PREMIER_CONTACT', outcome: 'SANS_REPONSE' },
    '2026-11-22T10:05:00.000Z',
  );

  const queue: SyncTask[] = [
    {
      id: 't_add',
      type: 'CUSTOMER',
      entityId: 'cust_target',
      name: 'Cible',
      actionType: 'ADD',
      payload: { name: 'Cible' },
      createdAt: '2026-11-22T09:00:00.000Z',
    },
    {
      id: 't_upd',
      type: 'CUSTOMER',
      entityId: 'cust_target',
      name: 'Cible',
      actionType: 'UPDATE',
      payload: { notes: 'MaJ' },
      createdAt: '2026-11-22T09:05:00.000Z',
    },
    {
      id: 't_int',
      type: 'CUSTOMER_INTERACTION',
      entityId: int1.id,
      name: 'Cible',
      actionType: 'ADD',
      payload: { customerId: 'cust_target', interaction: int1 },
      createdAt: '2026-11-22T10:00:00.000Z',
    },
    {
      id: 't_other_int',
      type: 'CUSTOMER_INTERACTION',
      entityId: intOther.id,
      name: 'Autre',
      actionType: 'ADD',
      payload: { customerId: 'cust_other', interaction: intOther },
      createdAt: '2026-11-22T10:05:00.000Z',
    },
  ];

  // Vérification du contrat dans customersSlice : deleteDoc précède updateSyncQueue(removeAllTasksForCustomer)
  const sliceSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/store/slices/customersSlice.ts'), 'utf8');
  const deleteStart = sliceSrc.indexOf('deleteCustomer: async (id) =>');
  const deleteBlock = sliceSrc.slice(deleteStart, sliceSrc.indexOf('setCustomers:', deleteStart));
  const posDeleteDoc = deleteBlock.indexOf('await deleteDoc(');
  const posPurge = deleteBlock.indexOf('removeAllTasksForCustomer(current, id)');
  assert.ok(posDeleteDoc > 0 && posPurge > posDeleteDoc);

  const purged = removeAllTasksForCustomer(queue, 'cust_target');
  assert.equal(purged.length, 1);
  assert.equal(purged[0].id, 't_other_int');
});

test('Durcissement 1b — Échec de deleteDoc en ligne conserve toutes les tâches en attente et restaure le prospect localement', async () => {
  const int1 = buildProspectInteraction(
    { id: 'int_keep', date: '2026-11-22', channel: 'APPEL', actionType: 'RELANCE', outcome: 'INTERESSE' },
    '2026-11-22T10:00:00.000Z',
  );
  const target = makeCustomer({ id: 'cust_fail_del', name: 'À préserver', interactions: [int1] });
  let customers = [target];
  let queue: SyncTask[] = [
    {
      id: 't_upd_keep',
      type: 'CUSTOMER',
      entityId: 'cust_fail_del',
      name: 'À préserver',
      actionType: 'UPDATE',
      payload: { notes: 'Note' },
      createdAt: '2026-11-22T09:30:00.000Z',
    },
    {
      id: 't_int_keep',
      type: 'CUSTOMER_INTERACTION',
      entityId: int1.id,
      name: 'À préserver',
      actionType: 'ADD',
      payload: { customerId: 'cust_fail_del', interaction: int1 },
      createdAt: '2026-11-22T10:00:00.000Z',
    },
  ];

  // Simule le chemin exact en ligne de deleteCustomer lorsque deleteDoc rejette
  const runOnlineDelete = async (deleteRemote: () => Promise<void>) => {
    const savedTarget = customers.find((c) => c.id === 'cust_fail_del');
    customers = customers.filter((c) => c.id !== 'cust_fail_del');
    try {
      await deleteRemote();
      queue = removeAllTasksForCustomer(queue, 'cust_fail_del');
    } catch (err) {
      if (savedTarget && !customers.some((c) => c.id === 'cust_fail_del')) {
        customers = [savedTarget, ...customers];
      }
      throw err;
    }
  };

  await assert.rejects(
    () =>
      runOnlineDelete(async () => {
        throw new Error('permission-denied');
      }),
    /permission-denied/,
  );

  // Tâches intactes + client restauré dans l'état local
  assert.equal(queue.length, 2);
  assert.equal(customers.length, 1);
  assert.equal(customers[0].id, 'cust_fail_del');
  assert.equal(customers[0].interactions?.length, 1);
});

test('Durcissement 1c — Suppression hors-ligne d’un prospect créé hors-ligne annule ADD et purge toutes ses interactions', () => {
  const int1 = buildProspectInteraction(
    { id: 'int_off_1', date: '2026-11-22', channel: 'WHATSAPP', actionType: 'PREMIER_CONTACT', outcome: 'SANS_REPONSE' },
    '2026-11-22T10:00:00.000Z',
  );
  const int2 = buildProspectInteraction(
    { id: 'int_off_2', date: '2026-11-22', channel: 'SMS', actionType: 'RELANCE', outcome: 'INTERESSE' },
    '2026-11-22T11:00:00.000Z',
  );

  let queue: SyncTask[] = [];
  queue = upsertEntityTaskInQueue(queue, {
    id: 'add_off',
    type: 'CUSTOMER',
    entityId: 'cust_never_synced',
    name: 'Prospect Offline',
    actionType: 'ADD',
    payload: makeCustomer({ id: 'cust_never_synced', name: 'Prospect Offline' }),
    createdAt: '2026-11-22T09:00:00.000Z',
  });
  queue = upsertEntityTaskInQueue(queue, {
    id: 'i1_off',
    type: 'CUSTOMER_INTERACTION',
    entityId: int1.id,
    name: 'Prospect Offline',
    actionType: 'ADD',
    payload: { customerId: 'cust_never_synced', interaction: int1 },
    createdAt: '2026-11-22T10:00:00.000Z',
  });
  queue = upsertEntityTaskInQueue(queue, {
    id: 'i2_off',
    type: 'CUSTOMER_INTERACTION',
    entityId: int2.id,
    name: 'Prospect Offline',
    actionType: 'ADD',
    payload: { customerId: 'cust_never_synced', interaction: int2 },
    createdAt: '2026-11-22T11:00:00.000Z',
  });
  assert.equal(queue.length, 3);

  queue = upsertEntityTaskInQueue(queue, {
    id: 'del_off',
    type: 'CUSTOMER',
    entityId: 'cust_never_synced',
    name: 'Prospect Offline',
    actionType: 'DELETE',
    payload: {},
    createdAt: '2026-11-22T12:00:00.000Z',
  });

  assert.equal(queue.length, 0);
  assert.equal(reconcileCustomersWithSyncQueue([], queue).length, 0);
});

test('Durcissement 2a — Coupure réseau / échec Agenda après interaction : aucune perte, aucun doublon à la reprise, et feedback fidèle', async () => {
  let interactionCalls = 0;
  let agendaCalls = 0;

  const firstAttempt = await executeComposedInteractionWithFollowUp({
    customerId: 'cust_1',
    customerName: 'Alice',
    customerPhone: '0600000000',
    stableInteractionId: 'int_stable_abc',
    alreadyCommittedInteraction: false,
    input: {
      date: '2026-11-22',
      channel: 'WHATSAPP',
      actionType: 'RELANCE',
      outcome: 'INTERESSE',
      nextFollowUpDate: '2026-11-25',
    },
    createAgendaFollowUp: true,
    addProspectInteraction: async () => {
      interactionCalls += 1;
      return 'queued';
    },
    addAgendaItem: async () => {
      agendaCalls += 1;
      throw new Error('permission-denied');
    },
  });

  assert.equal(interactionCalls, 1);
  assert.equal(agendaCalls, 1);
  assert.equal(firstAttempt.interactionStatus, 'queued');
  assert.equal(firstAttempt.agendaStatus, 'failed');
  assert.equal(firstAttempt.hasPartialAgendaFailure, true);
  assert.equal(firstAttempt.overallPersistence, 'queued');

  // Vérification que runFeedbackAction affiche un seul avertissement explicite quand getPartialWarning est fourni
  clearAllActionLocksForTest();
  const feedbackEvents: Array<{ level: string; message: string }> = [];
  await runFeedbackAction(
    {
      notifySuccess: (message) => feedbackEvents.push({ level: 'success', message }),
      notifyWarning: (message) => feedbackEvents.push({ level: 'warning', message }),
      notifyError: (message) => feedbackEvents.push({ level: 'error', message }),
      setPending: () => {},
    },
    {
      actionKey: 'test-partial-agenda',
      operation: async () => firstAttempt.overallPersistence,
      successMessage: 'Interaction enregistrée dans le journal !',
      queuedMessage: 'Interaction enregistrée hors-ligne.',
      errorContext: 'Échec',
      redirectToDashboard: false,
      getPartialWarning: () =>
        firstAttempt.hasPartialAgendaFailure
          ? `Interaction mise en file hors-ligne, mais la relance Agenda a échoué (${firstAttempt.agendaError}).`
          : undefined,
    },
  );
  assert.equal(feedbackEvents.length, 1);
  assert.equal(feedbackEvents[0].level, 'warning');
  assert.match(feedbackEvents[0].message, /relance Agenda a échoué/i);

  // Reprise après échec partiel avec alreadyCommittedInteraction=true -> NE ré-appelle PAS addProspectInteraction
  const retryAttempt = await executeComposedInteractionWithFollowUp({
    customerId: 'cust_1',
    customerName: 'Alice',
    customerPhone: '0600000000',
    stableInteractionId: 'int_stable_abc',
    alreadyCommittedInteraction: true,
    input: {
      date: '2026-11-22',
      channel: 'WHATSAPP',
      actionType: 'RELANCE',
      outcome: 'INTERESSE',
      nextFollowUpDate: '2026-11-25',
    },
    createAgendaFollowUp: true,
    addProspectInteraction: async () => {
      interactionCalls += 1;
      return 'saved';
    },
    addAgendaItem: async () => {
      agendaCalls += 1;
      return 'saved';
    },
  });

  assert.equal(interactionCalls, 1); // zéro doublon !
  assert.equal(agendaCalls, 2);
  assert.equal(retryAttempt.hasPartialAgendaFailure, false);
  assert.equal(retryAttempt.agendaStatus, 'saved');
});

test('Durcissement 2b — Reprise d’une conversion après échec de updateCustomer : zéro duplication de l’interaction CONVERTI', async () => {
  const prospect = makeCustomer({
    id: 'cust_conv_1',
    name: 'Prospect Conversion',
    lastContactDate: '2026-11-18',
    interactions: [],
  });

  let localProspect = { ...prospect, interactions: [] as ProspectInteraction[] };
  let addInteractionCalls = 0;
  let updateCalls = 0;

  const expectedId = buildConversionInteractionId('cust_conv_1', '2026-11-22', 'WHATSAPP');

  // Tentative 1 : interaction créée, puis updateCustomer échoue (ex. erreur permanente ou coupure)
  await assert.rejects(
    () =>
      executeComposedProspectConversion({
        prospect: localProspect,
        conversionChannel: 'WHATSAPP',
        convertedAt: '2026-11-22',
        logConversionInteraction: true,
        addProspectInteraction: async (_cid, input) => {
          addInteractionCalls += 1;
          const built = buildProspectInteraction(input, '2026-11-22T12:00:00.000Z');
          localProspect = {
            ...localProspect,
            interactions: mergeInteractionsUnique(localProspect.interactions, [built]),
            lastContactDate: maxIsoDate(localProspect.lastContactDate, built.date),
          };
          return 'saved';
        },
        updateCustomer: async () => {
          updateCalls += 1;
          throw new Error('temporary failure');
        },
      }),
    /temporary failure/,
  );

  assert.equal(addInteractionCalls, 1);
  assert.equal(updateCalls, 1);
  assert.equal(localProspect.interactions.length, 1);
  assert.equal(localProspect.interactions[0].id, expectedId);
  assert.equal(
    hasRecordedConversionInteraction(localProspect, 'WHATSAPP', '2026-11-22', expectedId),
    true,
  );

  // Tentative 2 : l'interaction CONVERTI est déjà présente -> ne doit PAS être recréée
  const res2 = await executeComposedProspectConversion({
    prospect: localProspect,
    conversionChannel: 'WHATSAPP',
    convertedAt: '2026-11-22',
    logConversionInteraction: true,
    addProspectInteraction: async () => {
      addInteractionCalls += 1;
      return 'saved';
    },
    updateCustomer: async (updated) => {
      updateCalls += 1;
      localProspect = { ...updated, interactions: localProspect.interactions };
      return 'saved';
    },
  });

  assert.equal(addInteractionCalls, 1); // jamais dupliquée !
  assert.equal(updateCalls, 2);
  assert.equal(res2.interactionStatus, 'skipped');
  assert.equal(res2.conversionStatus, 'saved');
  assert.equal(localProspect.status, CustomerStatus.CLIENT);
  assert.equal(localProspect.convertedFromProspect, true);
  assert.equal(localProspect.interactions.length, 1);
});

test('Durcissement 3 & 8 — Hydratation hors-ligne au démarrage à froid puis arrivée onSnapshot sans aucun doublon', () => {
  const sliceSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/store/slices/customersSlice.ts'), 'utf8');
  const initStart = sliceSrc.indexOf('initializeListener: () =>');
  const initBlock = sliceSrc.slice(initStart);
  const posInitialReconcile = initBlock.indexOf('reconcileCustomersWithSyncQueue(state.customers, initialQueue)');
  const posOnSnapshot = initBlock.indexOf('onSnapshot(');
  assert.ok(posInitialReconcile > 0 && posOnSnapshot > posInitialReconcile);

  const intOffline = buildProspectInteraction(
    { id: 'int_cold_1', date: '2026-11-22', channel: 'WHATSAPP', actionType: 'PREMIER_CONTACT', outcome: 'INTERESSE' },
    '2026-11-22T09:30:00.000Z',
  );

  const syncQueue: SyncTask[] = [
    {
      id: 'q_cold_add',
      type: 'CUSTOMER',
      entityId: 'cust_cold_1',
      name: 'Prospect Froid',
      actionType: 'ADD',
      payload: makeCustomer({ id: 'cust_cold_1', name: 'Prospect Froid', lastContactDate: '2026-11-20' }),
      createdAt: '2026-11-20T09:00:00.000Z',
    },
    {
      id: 'q_cold_upd',
      type: 'CUSTOMER',
      entityId: 'cust_cold_1',
      name: 'Prospect Froid',
      actionType: 'UPDATE',
      payload: { notes: 'Modifié hors-ligne', interactions: [] },
      createdAt: '2026-11-22T09:10:00.000Z',
    },
    {
      id: 'q_cold_int',
      type: 'CUSTOMER_INTERACTION',
      entityId: intOffline.id,
      name: 'Prospect Froid',
      actionType: 'ADD',
      payload: { customerId: 'cust_cold_1', interaction: intOffline },
      createdAt: '2026-11-22T09:30:00.000Z',
    },
  ];

  // 1) Démarrage à froid avant onSnapshot (customers initialement vide [])
  const coldHydrated = reconcileCustomersWithSyncQueue([], syncQueue);
  assert.equal(coldHydrated.length, 1);
  assert.equal(coldHydrated[0].id, 'cust_cold_1');
  assert.equal(coldHydrated[0].notes, 'Modifié hors-ligne');
  assert.equal(coldHydrated[0].interactions?.length, 1);
  assert.equal(coldHydrated[0].lastContactDate, '2026-11-22');
  assert.equal(coldHydrated[0].synced, false);

  // 2) Réception ultérieure de onSnapshot contenant déjà la fiche et l'interaction -> zéro doublon
  const snapshotCustomers: Customer[] = [
    makeCustomer({
      id: 'cust_cold_1',
      name: 'Prospect Froid',
      notes: 'Modifié hors-ligne',
      lastContactDate: '2026-11-22',
      interactions: [intOffline],
      synced: true,
    }),
  ];
  const afterSnapshotWhileStillQueued = reconcileCustomersWithSyncQueue(snapshotCustomers, syncQueue);
  assert.equal(afterSnapshotWhileStillQueued.length, 1);
  assert.equal(afterSnapshotWhileStillQueued[0].interactions?.length, 1);
  assert.equal(afterSnapshotWhileStillQueued[0].synced, false);

  // Une fois la file vidée, synced repasse à true sans doublon
  const afterQueueCleared = reconcileCustomersWithSyncQueue(snapshotCustomers, []);
  assert.equal(afterQueueCleared.length, 1);
  assert.equal(afterQueueCleared[0].interactions?.length, 1);
  assert.equal(afterQueueCleared[0].synced, true);
});

test('Durcissement 4 — Relance séquentielle automatique : interaction ajoutée pendant CUSTOMER ADD en cours passe strictement en Passe 2 sans concurrence', async () => {
  const runner = createSerializedSyncRunner(5);
  let queue: SyncTask[] = [
    {
      id: 't_parent_add',
      type: 'CUSTOMER',
      entityId: 'cust_race_1',
      name: 'Prospect Concurrent',
      actionType: 'ADD',
      payload: makeCustomer({ id: 'cust_race_1', name: 'Prospect Concurrent' }),
      createdAt: '2026-11-22T10:00:00.000Z',
    },
  ];

  const lateInteraction = buildProspectInteraction(
    { id: 'int_race_1', date: '2026-11-22', channel: 'APPEL', actionType: 'PREMIER_CONTACT', outcome: 'INTERESSE' },
    '2026-11-22T10:01:00.000Z',
  );

  let inFlightPasses = 0;
  let maxConcurrentPasses = 0;
  const executionLog: string[] = [];
  let passNumber = 0;

  const triggerSync = () =>
    runner.run({
      canStart: () => queue.some(isTaskEligibleForAutoSync),
      runPass: async () => {
        passNumber += 1;
        const currentPass = passNumber;
        inFlightPasses += 1;
        maxConcurrentPasses = Math.max(maxConcurrentPasses, inFlightPasses);
        try {
          return await executeSyncQueueBatch({
            getQueue: () => queue,
            setQueue: (updater) => {
              queue = updater(queue);
            },
            isOffline: () => false,
            executeTask: async (task) => {
              executionLog.push(`p${currentPass}:${task.id}`);
              if (task.id === 't_parent_add') {
                // Simule l'utilisateur qui ajoute une interaction PENDANT l'await du CUSTOMER ADD parent
                await Promise.resolve();
                queue = upsertEntityTaskInQueue(queue, {
                  id: 't_child_int',
                  type: 'CUSTOMER_INTERACTION',
                  entityId: lateInteraction.id,
                  name: 'Prospect Concurrent',
                  actionType: 'ADD',
                  payload: { customerId: 'cust_race_1', interaction: lateInteraction },
                  createdAt: '2026-11-22T10:01:00.000Z',
                });
                // Appelle triggerSync pendant la passe en cours -> doit simplement demander une re-passe
                void triggerSync();
              }
            },
          });
        } finally {
          inFlightPasses -= 1;
        }
      },
    });

  const totals = await triggerSync();
  assert.ok(totals !== null);
  assert.equal(maxConcurrentPasses, 1); // zéro exécution concurrente
  assert.equal(totals.passesExecuted, 2); // Passe 1 puis Passe 2 séquentielle
  assert.equal(totals.syncedCount, 2);
  assert.deepEqual(executionLog, ['p1:t_parent_add', 'p2:t_child_int']);
  assert.equal(queue.length, 0);
});

test('Durcissement 5 — Recalcul exact de lastContactDate lors de Ignorer sur une CUSTOMER_INTERACTION en erreur permanente', () => {
  const olderValid = buildProspectInteraction(
    { id: 'int_valid_old', date: '2026-11-18', channel: 'WHATSAPP', actionType: 'PREMIER_CONTACT', outcome: 'INTERESSE' },
    '2026-11-18T10:00:00.000Z',
  );
  const failedNew = buildProspectInteraction(
    { id: 'int_perm_fail', date: '2026-11-22', channel: 'APPEL', actionType: 'RELANCE', outcome: 'SANS_REPONSE' },
    '2026-11-22T11:00:00.000Z',
  );

  const dismissedTask: SyncTask = {
    id: 'sync_fail_int',
    type: 'CUSTOMER_INTERACTION',
    entityId: failedNew.id,
    name: 'Prospect Test',
    actionType: 'ADD',
    payload: {
      customerId: 'cust_dismiss_1',
      interaction: failedNew,
      previousLastContactDate: '2026-11-10',
    },
    createdAt: '2026-11-22T11:00:00.000Z',
    permanentError: true,
  };

  // Cas 1 : autre interaction valide restante (2026-11-18) > previousLastContactDate (2026-11-10)
  const customerWithOlderInteraction = makeCustomer({
    id: 'cust_dismiss_1',
    name: 'Prospect Test',
    lastContactDate: '2026-11-22',
    interactions: [olderValid, failedNew],
    synced: false,
  });
  const afterDismiss1 = recomputeCustomerAfterDismissedInteraction(
    customerWithOlderInteraction,
    dismissedTask,
    [],
  );
  assert.equal(afterDismiss1.interactions?.length, 1);
  assert.equal(afterDismiss1.interactions?.[0].id, 'int_valid_old');
  assert.equal(afterDismiss1.lastContactDate, '2026-11-18');
  assert.equal(afterDismiss1.synced, true);

  // Cas 2 : aucune autre interaction restante -> restaure previousLastContactDate ('2026-11-10')
  const customerWithoutOtherInteractions = makeCustomer({
    id: 'cust_dismiss_1',
    name: 'Prospect Test',
    lastContactDate: '2026-11-22',
    interactions: [failedNew],
    synced: false,
  });
  const afterDismiss2 = recomputeCustomerAfterDismissedInteraction(
    customerWithoutOtherInteractions,
    dismissedTask,
    [],
  );
  assert.equal(afterDismiss2.interactions?.length, 0);
  assert.equal(afterDismiss2.lastContactDate, '2026-11-10');

  // Cas 3 : valeur serveur plus récente (2026-11-25) -> ne doit JAMAIS être abaissée
  const customerWithNewerServerDate = makeCustomer({
    id: 'cust_dismiss_1',
    name: 'Prospect Test',
    lastContactDate: '2026-11-25',
    interactions: [olderValid, failedNew],
    synced: false,
  });
  const afterDismiss3 = recomputeCustomerAfterDismissedInteraction(
    customerWithNewerServerDate,
    dismissedTask,
    [],
  );
  assert.equal(afterDismiss3.lastContactDate, '2026-11-25');
});
