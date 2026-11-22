import { Customer, ProspectInteraction } from '../types';
import {
  getEffectiveLastContactDate,
  maxIsoDate,
  mergeInteractionsUnique,
  normalizeValidIsoDate,
  sanitizeInteractionForFirestore,
  stripInteractionsFromCustomerUpdatePayload,
} from './prospectInteractions';

export type SyncEntityType =
  | 'CUSTOMER'
  | 'CUSTOMER_INTERACTION'
  | 'ORDER'
  | 'BUDGET'
  | 'AGENDA'
  | 'DAILY_LOG';
export type SyncActionType = 'ADD' | 'UPDATE' | 'DELETE';

export interface SyncTask {
  id: string;
  type: SyncEntityType;
  entityId: string;
  name: string;
  actionType: SyncActionType;
  payload: any;
  createdAt: string;
  retryCount?: number;
  lastError?: string;
  lastAttemptAt?: string;
  permanentError?: boolean;
  blockedByTaskId?: string;
  blockedReason?: string;
}

export interface CustomerInteractionSyncPayload {
  customerId: string;
  interaction: ProspectInteraction;
  previousLastContactDate?: string;
}

export const SYNC_QUEUE_KEY = 'fcf-sync-queue';
export const SIMULATED_OFFLINE_KEY = 'fcf-simulated-offline';

export function computeIsOfflineMode(isOnline: boolean, isSimulatedOffline: boolean): boolean {
  return !isOnline || isSimulatedOffline;
}

export function readInitialSyncQueue(): SyncTask[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function readInitialSimulatedOffline(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(SIMULATED_OFFLINE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function persistSyncQueue(queue: SyncTask[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error(e);
  }
}

export type SyncErrorClassification = 'RETRYABLE' | 'PERMANENT';

const PERMANENT_FIRESTORE_CODES = new Set([
  'permission-denied',
  'unauthenticated',
  'invalid-argument',
  'failed-precondition',
  'already-exists',
  'data-loss',
  'out-of-range',
]);

const RETRYABLE_FIRESTORE_CODES = new Set([
  'unavailable',
  'deadline-exceeded',
  'aborted',
  'resource-exhausted',
  'cancelled',
  'internal',
  'unknown',
]);

export function extractSyncErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const directCode = (error as { code?: unknown }).code;
  if (typeof directCode === 'string' && directCode.trim()) {
    return directCode.trim().toLowerCase();
  }
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith('{')) {
    try {
      const parsed = JSON.parse(message) as { code?: string; error?: string };
      if (typeof parsed.code === 'string' && parsed.code.trim()) {
        return parsed.code.trim().toLowerCase();
      }
      if (typeof parsed.error === 'string') {
        const lower = parsed.error.toLowerCase();
        if (lower.includes('missing or insufficient permissions')) return 'permission-denied';
        if (lower.includes('client is offline')) return 'unavailable';
      }
    } catch {
      // ignore invalid JSON
    }
  }
  return '';
}

export function extractSyncErrorMessage(error: unknown): string {
  if (!error) return 'Erreur inconnue de synchronisation.';
  const rawMessage = error instanceof Error ? error.message : String(error);
  if (rawMessage.startsWith('{')) {
    try {
      const parsed = JSON.parse(rawMessage) as { error?: string };
      if (typeof parsed.error === 'string' && parsed.error.trim()) {
        return parsed.error.trim();
      }
    } catch {
      // ignore
    }
  }
  return rawMessage || 'Erreur inconnue de synchronisation.';
}

/**
 * Distingue de façon déterministe une erreur réseau/transitoire (rejouable sans perte)
 * d'une erreur définitive (permissions, document supprimé sans création parentale, payload invalide).
 */
export function classifySyncError(
  error: unknown,
  options?: { isOnline?: boolean; hasPendingParentAdd?: boolean },
): SyncErrorClassification {
  if (options?.isOnline === false) {
    return 'RETRYABLE';
  }

  const code = extractSyncErrorCode(error);
  if (code === 'not-found') {
    return options?.hasPendingParentAdd ? 'RETRYABLE' : 'PERMANENT';
  }
  if (PERMANENT_FIRESTORE_CODES.has(code)) {
    return 'PERMANENT';
  }
  if (RETRYABLE_FIRESTORE_CODES.has(code)) {
    return 'RETRYABLE';
  }

  const msg = extractSyncErrorMessage(error).toLowerCase();
  if (
    msg.includes('permission') ||
    msg.includes('insufficient permissions') ||
    msg.includes('unauthenticated') ||
    msg.includes('invalid-argument') ||
    msg.includes('invalid argument') ||
    msg.includes('n’existe plus') ||
    msg.includes("n'existe plus") ||
    msg.includes('not-found') ||
    msg.includes('not found')
  ) {
    if (msg.includes('not-found') || msg.includes('not found') || msg.includes('n’existe plus')) {
      return options?.hasPendingParentAdd ? 'RETRYABLE' : 'PERMANENT';
    }
    return 'PERMANENT';
  }

  if (
    msg.includes('offline') ||
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('unavailable') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('econnreset')
  ) {
    return 'RETRYABLE';
  }

  // Par défaut, une erreur technique inattendue reste rejouable afin de ne jamais perdre silencieusement de données.
  return 'RETRYABLE';
}

export function getCustomerIdForSyncTask(task: SyncTask): string | null {
  if (task.type === 'CUSTOMER') return task.entityId;
  if (task.type === 'CUSTOMER_INTERACTION') {
    const cid = task.payload?.customerId;
    return typeof cid === 'string' && cid.trim() ? cid : null;
  }
  return null;
}

export function removePendingInteractionsForCustomer(
  queue: SyncTask[],
  customerId: string,
): SyncTask[] {
  return queue.filter(
    (t) => !(t.type === 'CUSTOMER_INTERACTION' && t.payload?.customerId === customerId),
  );
}

export function removeAllTasksForCustomer(
  queue: SyncTask[],
  customerId: string,
): SyncTask[] {
  return queue.filter((t) => getCustomerIdForSyncTask(t) !== customerId);
}

/**
 * Recalcule l'état local d'un prospect après le rejet (« Ignorer ») d'une interaction
 * en erreur permanente :
 * - retire uniquement l'interaction non enregistrée sur Firestore ;
 * - recalcule `lastContactDate` via `getEffectiveLastContactDate` ;
 * - préserve `previousLastContactDate` ou une valeur serveur plus récente sans jamais l'abaisser.
 */
export function recomputeCustomerAfterDismissedInteraction(
  customer: Customer,
  dismissedTask: SyncTask,
  remainingQueue: SyncTask[],
): Customer {
  const remainingInteractions = (customer.interactions || []).filter(
    (i) => i.id !== dismissedTask.entityId,
  );
  const stillPending = hasPendingTaskForCustomer(remainingQueue, customer.id);

  const dismissedDate = normalizeValidIsoDate(dismissedTask.payload?.interaction?.date);
  const previousLast = normalizeValidIsoDate(dismissedTask.payload?.previousLastContactDate);
  const currentLast = normalizeValidIsoDate(customer.lastContactDate);

  // Si la date actuelle provient d'une valeur serveur/externe plus récente que l'interaction rejetée, la préserver.
  const baselineLast =
    currentLast && (!dismissedDate || currentLast > dismissedDate)
      ? maxIsoDate(currentLast, previousLast)
      : previousLast;

  const recalculatedLast = getEffectiveLastContactDate({
    lastContactDate: baselineLast,
    interactions: remainingInteractions,
  });

  return {
    ...customer,
    interactions: remainingInteractions,
    lastContactDate: recalculatedLast,
    synced: !stillPending,
  };
}

/**
 * Fusionne proprement les tâches hors-ligne pour une même entité :
 * - CUSTOMER_INTERACTION : identifiée par `entityId = interaction.id` -> chaque interaction d'un même
 *   prospect reste indépendante dans la file (idempotente si le même interaction.id est soumis deux fois).
 * - CUSTOMER UPDATE : ne contient jamais `interactions` afin de ne jamais écraser le journal.
 * - ADD puis UPDATE -> fusionne dans l'ADD initial (en conservant lastContactDate maximal et interactions existantes).
 * - ADD puis DELETE -> annule l'ADD local ET purge les CUSTOMER_INTERACTION liées à ce prospect.
 * - UPDATE/DELETE répétés -> conserve la dernière intention (et purge les interactions si DELETE).
 */
export function upsertEntityTaskInQueue(queue: SyncTask[], rawTask: SyncTask): SyncTask[] {
  if (rawTask.type === 'CUSTOMER_INTERACTION') {
    const cleanInteraction = sanitizeInteractionForFirestore(rawTask.payload.interaction);
    const prevLast = normalizeValidIsoDate(rawTask.payload?.previousLastContactDate);
    const normalizedTask: SyncTask = {
      ...rawTask,
      actionType: 'ADD',
      entityId: cleanInteraction.id,
      payload: {
        customerId: rawTask.payload.customerId,
        interaction: cleanInteraction,
        ...(prevLast ? { previousLastContactDate: prevLast } : {}),
      },
    };
    const alreadyExists = queue.some(
      (t) => t.type === 'CUSTOMER_INTERACTION' && t.entityId === normalizedTask.entityId,
    );
    if (alreadyExists) {
      return queue;
    }
    return [...queue, normalizedTask];
  }

  const task: SyncTask =
    rawTask.type === 'CUSTOMER' && rawTask.actionType === 'UPDATE'
      ? {
          ...rawTask,
          payload: stripInteractionsFromCustomerUpdatePayload(rawTask.payload || {}),
        }
      : rawTask;

  const baseQueue =
    task.type === 'CUSTOMER' && task.actionType === 'DELETE'
      ? removePendingInteractionsForCustomer(queue, task.entityId)
      : queue;

  const existingAddIdx = baseQueue.findIndex(
    (t) => t.type === task.type && t.entityId === task.entityId && t.actionType === 'ADD',
  );

  if (existingAddIdx >= 0) {
    if (task.actionType === 'ADD' || task.actionType === 'UPDATE') {
      return baseQueue.map((t, idx) => {
        if (idx !== existingAddIdx) return t;
        const mergedPayload = { ...t.payload, ...task.payload };
        if (task.type === 'CUSTOMER') {
          const maxLast = maxIsoDate(t.payload?.lastContactDate, task.payload?.lastContactDate);
          if (maxLast) {
            mergedPayload.lastContactDate = maxLast;
          }
          if (Array.isArray(t.payload?.interactions)) {
            mergedPayload.interactions = t.payload.interactions;
          }
        }
        return {
          ...t,
          name: task.name || t.name,
          payload: mergedPayload,
        };
      });
    }
    if (task.actionType === 'DELETE') {
      return baseQueue.filter((_, idx) => idx !== existingAddIdx);
    }
  }

  const existingUpdateIdx = baseQueue.findIndex(
    (t) => t.type === task.type && t.entityId === task.entityId && t.actionType === 'UPDATE',
  );

  if (task.actionType === 'UPDATE' && existingUpdateIdx >= 0) {
    return baseQueue.map((t, idx) => {
      if (idx !== existingUpdateIdx) return t;
      const mergedPayload = { ...t.payload, ...task.payload };
      if (task.type === 'CUSTOMER') {
        const maxLast = maxIsoDate(t.payload?.lastContactDate, task.payload?.lastContactDate);
        if (maxLast) {
          mergedPayload.lastContactDate = maxLast;
        }
        delete mergedPayload.interactions;
      }
      return {
        ...task,
        payload: mergedPayload,
      };
    });
  }

  const filtered = baseQueue.filter(
    (t) =>
      !(
        t.type === task.type &&
        t.entityId === task.entityId &&
        (t.actionType === 'UPDATE' || t.actionType === 'DELETE')
      ),
  );
  return [...filtered, task];
}

export function upsertOrderTaskInQueue(queue: SyncTask[], task: SyncTask): SyncTask[] {
  return upsertEntityTaskInQueue(queue, task);
}

/**
 * Ordonne les tâches de façon déterministe :
 * 1) Créations (CUSTOMER ADD avant tout)
 * 2) Mises à jour & interactions (CUSTOMER UPDATE, CUSTOMER_INTERACTION, etc.)
 * 3) Suppressions
 */
export function orderSyncTasksForExecution(queue: SyncTask[]): SyncTask[] {
  const priority = (task: SyncTask): number => {
    if (task.type === 'CUSTOMER' && task.actionType === 'ADD') return 0;
    if (task.type !== 'CUSTOMER_INTERACTION' && task.actionType === 'ADD') return 1;
    if (task.type === 'CUSTOMER' && task.actionType === 'UPDATE') return 2;
    if (task.type === 'CUSTOMER_INTERACTION') return 3;
    if (task.actionType === 'UPDATE') return 4;
    return 5;
  };
  return queue
    .map((task, idx) => ({ task, idx }))
    .sort((a, b) => {
      const diff = priority(a.task) - priority(b.task);
      return diff !== 0 ? diff : a.idx - b.idx;
    })
    .map((entry) => entry.task);
}

export function isTaskEligibleForAutoSync(task: SyncTask): boolean {
  return !task.permanentError && !task.blockedByTaskId;
}

export function markTaskRetryFailure(
  queue: SyncTask[],
  taskId: string,
  errorMessage: string,
  classification: SyncErrorClassification,
  nowIso: string = new Date().toISOString(),
): SyncTask[] {
  const isPermanent = classification === 'PERMANENT';
  const failedTask = queue.find((t) => t.id === taskId);

  let next = queue.map((t) =>
    t.id === taskId
      ? {
          ...t,
          retryCount: (t.retryCount || 0) + 1,
          lastError: errorMessage,
          lastAttemptAt: nowIso,
          permanentError: isPermanent,
          blockedByTaskId: undefined,
          blockedReason: undefined,
        }
      : t,
  );

  // Si un CUSTOMER ADD échoue définitivement, marquer explicitement toutes les interactions/MAJ dépendantes comme bloquées.
  if (isPermanent && failedTask?.type === 'CUSTOMER' && failedTask.actionType === 'ADD') {
    const blockedCustomerId = failedTask.entityId;
    next = next.map((t) => {
      const dependsOnFailedAdd =
        (t.type === 'CUSTOMER_INTERACTION' && t.payload?.customerId === blockedCustomerId) ||
        (t.type === 'CUSTOMER' && t.actionType === 'UPDATE' && t.entityId === blockedCustomerId);
      if (!dependsOnFailedAdd) return t;
      return {
        ...t,
        blockedByTaskId: failedTask.id,
        blockedReason: `Création du prospect "${failedTask.name}" en erreur permanente : ${errorMessage}`,
      };
    });
  }

  return next;
}

export function clearTaskErrorAndUnblockDependents(queue: SyncTask[], taskId: string): SyncTask[] {
  return queue.map((t) => {
    if (t.id === taskId) {
      const {
        permanentError: _p,
        blockedByTaskId: _b,
        blockedReason: _r,
        lastError: _l,
        ...rest
      } = t;
      return rest;
    }
    if (t.blockedByTaskId === taskId) {
      const { blockedByTaskId: _b, blockedReason: _r, ...rest } = t;
      return rest;
    }
    return t;
  });
}

export function dismissTaskWithDependents(queue: SyncTask[], taskId: string): SyncTask[] {
  const target = queue.find((t) => t.id === taskId);
  if (!target) return queue;
  return queue.filter((t) => {
    if (t.id === taskId) return false;
    if (t.blockedByTaskId === taskId) return false;
    if (
      target.type === 'CUSTOMER' &&
      target.actionType === 'ADD' &&
      t.type === 'CUSTOMER_INTERACTION' &&
      t.payload?.customerId === target.entityId
    ) {
      return false;
    }
    return true;
  });
}

/**
 * Réconcilie les fiches Firestore (reçues par onSnapshot ou rechargement) avec les tâches
 * locales encore présentes dans `syncQueue` (`CUSTOMER` et `CUSTOMER_INTERACTION`) :
 * - réapplique les créations locales en attente (`CUSTOMER ADD`) ;
 * - applique les MAJ locales sans jamais écraser `interactions` ;
 * - fusionne et déduplique les `CUSTOMER_INTERACTION` en attente ;
 * - garantit `lastContactDate` monotone via `maxIsoDate` ;
 * - masque les fiches supprimées hors-ligne (`CUSTOMER DELETE`) et marque `synced: false` si en attente.
 */
export function reconcileCustomersWithSyncQueue(
  firestoreCustomers: Customer[],
  syncQueue: SyncTask[],
): Customer[] {
  if (!syncQueue || syncQueue.length === 0) {
    return firestoreCustomers;
  }

  const customerMap = new Map<string, Customer>();
  const orderedIds: string[] = [];

  for (const c of firestoreCustomers) {
    customerMap.set(c.id, { ...c });
    orderedIds.push(c.id);
  }

  const pendingCustomerIds = new Set<string>();

  for (const task of syncQueue) {
    if (task.type === 'CUSTOMER') {
      const id = task.entityId;
      pendingCustomerIds.add(id);

      if (task.actionType === 'DELETE') {
        customerMap.delete(id);
        continue;
      }

      if (task.actionType === 'ADD') {
        const existing = customerMap.get(id);
        const mergedInteractions = mergeInteractionsUnique(
          existing?.interactions,
          task.payload?.interactions,
        );
        const merged: Customer = {
          ...(task.payload || {}),
          ...(existing || {}),
          id,
          ...(mergedInteractions.length > 0 ? { interactions: mergedInteractions } : {}),
          lastContactDate: maxIsoDate(
            existing?.lastContactDate,
            task.payload?.lastContactDate,
            ...mergedInteractions.map((i) => i.date),
          ),
          synced: false,
        } as Customer;
        customerMap.set(id, merged);
        if (!orderedIds.includes(id)) {
          orderedIds.unshift(id);
        }
        continue;
      }

      if (task.actionType === 'UPDATE') {
        const existing = customerMap.get(id);
        if (existing) {
          const safePatch = stripInteractionsFromCustomerUpdatePayload(task.payload || {});
          customerMap.set(id, {
            ...existing,
            ...safePatch,
            id,
            interactions: existing.interactions,
            lastContactDate: maxIsoDate(
              existing.lastContactDate,
              (safePatch as Partial<Customer>).lastContactDate,
              ...(existing.interactions || []).map((i) => i.date),
            ),
            synced: false,
          });
        }
      }
    }
  }

  for (const task of syncQueue) {
    if (task.type !== 'CUSTOMER_INTERACTION') continue;
    const customerId = task.payload?.customerId as string | undefined;
    const interaction = task.payload?.interaction as ProspectInteraction | undefined;
    if (!customerId || !interaction) continue;
    const existing = customerMap.get(customerId);
    if (!existing) continue;

    pendingCustomerIds.add(customerId);
    const mergedInteractions = mergeInteractionsUnique(existing.interactions, [interaction]);
    customerMap.set(customerId, {
      ...existing,
      interactions: mergedInteractions,
      lastContactDate: maxIsoDate(
        existing.lastContactDate,
        interaction.date,
        ...mergedInteractions.map((i) => i.date),
      ),
      synced: false,
    });
  }

  const result: Customer[] = [];
  for (const id of orderedIds) {
    const item = customerMap.get(id);
    if (!item) continue;
    result.push(
      pendingCustomerIds.has(id) && item.synced !== false ? { ...item, synced: false } : item,
    );
  }
  return result;
}

export function hasPendingCustomerAdd(queue: SyncTask[], customerId: string): boolean {
  return queue.some(
    (t) => t.type === 'CUSTOMER' && t.actionType === 'ADD' && t.entityId === customerId,
  );
}

export function hasPendingTaskForCustomer(queue: SyncTask[], customerId: string): boolean {
  return queue.some((t) => getCustomerIdForSyncTask(t) === customerId);
}

export interface SyncBatchSummary {
  syncedCount: number;
  retryableFailedCount: number;
  permanentFailedCount: number;
  deferredCount: number;
  blockedByParentCount: number;
}

export interface ExecuteSyncQueueBatchDeps {
  getQueue: () => SyncTask[];
  setQueue: (updater: (current: SyncTask[]) => SyncTask[]) => void;
  isOffline: () => boolean;
  executeTask: (task: SyncTask) => Promise<void>;
  onTaskSynced?: (task: SyncTask, updatedQueue: SyncTask[]) => void;
  nowIso?: () => string;
}

/**
 * Exécute une passe séquentielle et déterministe de synchronisation :
 * - Ordre strict : CUSTOMER ADD -> CUSTOMER UPDATE -> CUSTOMER_INTERACTION -> autres
 * - Ignore les tâches déjà en erreur permanente ou explicitement bloquées
 * - Si CUSTOMER ADD échoue (transitoire ou permanent), diffère/bloque les CUSTOMER_INTERACTION
 *   dépendantes sans tentative Firestore erronée
 * - Met à jour la file de manière fonctionnelle pour préserver toute nouvelle tâche ajoutée pendant l'await.
 */
export async function executeSyncQueueBatch(
  deps: ExecuteSyncQueueBatchDeps,
): Promise<SyncBatchSummary> {
  const nowIso = deps.nowIso || (() => new Date().toISOString());
  const snapshot = deps.getQueue();
  const eligibleTasks = orderSyncTasksForExecution(snapshot.filter(isTaskEligibleForAutoSync));

  let syncedCount = 0;
  let retryableFailedCount = 0;
  let permanentFailedCount = 0;
  let deferredCount = 0;
  let blockedByParentCount = 0;

  const failedTransientAddCustomers = new Set<string>();
  const failedPermanentAddByCustomer = new Map<string, { taskId: string; name: string; error: string }>();

  for (const task of eligibleTasks) {
    if (deps.isOffline()) break;

    // Vérifie que la tâche existe encore (par ex. pas annulée pendant le batch)
    const currentQueue = deps.getQueue();
    const liveTask = currentQueue.find((t) => t.id === task.id);
    if (!liveTask) continue;

    // Gestion explicite de la dépendance CUSTOMER ADD -> CUSTOMER_INTERACTION / CUSTOMER UPDATE
    const customerId = getCustomerIdForSyncTask(liveTask);
    if (
      customerId &&
      !(liveTask.type === 'CUSTOMER' && liveTask.actionType === 'ADD')
    ) {
      const permanentParent = failedPermanentAddByCustomer.get(customerId);
      if (permanentParent) {
        if (liveTask.blockedByTaskId !== permanentParent.taskId) {
          deps.setQueue((q) =>
            q.map((t) =>
              t.id === liveTask.id
                ? {
                    ...t,
                    blockedByTaskId: permanentParent.taskId,
                    blockedReason: `Création du prospect "${permanentParent.name}" en erreur permanente : ${permanentParent.error}`,
                  }
                : t,
            ),
          );
        }
        blockedByParentCount += 1;
        continue;
      }

      if (!isTaskEligibleForAutoSync(liveTask)) continue;

      if (failedTransientAddCustomers.has(customerId) || hasPendingCustomerAdd(currentQueue, customerId)) {
        deferredCount += 1;
        continue;
      }
    } else if (!isTaskEligibleForAutoSync(liveTask)) {
      continue;
    }

    try {
      await deps.executeTask(liveTask);
      let nextQueueSnapshot: SyncTask[] = [];
      deps.setQueue((q) => {
        nextQueueSnapshot = q.filter((t) => t.id !== liveTask.id);
        return nextQueueSnapshot;
      });
      deps.onTaskSynced?.(liveTask, nextQueueSnapshot);
      syncedCount += 1;
    } catch (err) {
      const hasParentAdd = Boolean(customerId && hasPendingCustomerAdd(deps.getQueue(), customerId));
      const classification = classifySyncError(err, {
        isOnline: !deps.isOffline(),
        hasPendingParentAdd: hasParentAdd,
      });
      const message = extractSyncErrorMessage(err);

      deps.setQueue((q) => markTaskRetryFailure(q, liveTask.id, message, classification, nowIso()));

      if (liveTask.type === 'CUSTOMER' && liveTask.actionType === 'ADD') {
        if (classification === 'PERMANENT') {
          failedPermanentAddByCustomer.set(liveTask.entityId, {
            taskId: liveTask.id,
            name: liveTask.name,
            error: message,
          });
        } else {
          failedTransientAddCustomers.add(liveTask.entityId);
        }
      }

      if (classification === 'PERMANENT') {
        permanentFailedCount += 1;
      } else {
        retryableFailedCount += 1;
      }
    }
  }

  return {
    syncedCount,
    retryableFailedCount,
    permanentFailedCount,
    deferredCount,
    blockedByParentCount,
  };
}

export interface SerializedSyncRunTotals {
  syncedCount: number;
  retryableFailedCount: number;
  permanentFailedCount: number;
  blockedByParentCount: number;
  passesExecuted: number;
}

/**
 * Sérialise les déclenchements de synchronisation :
 * - Si une passe est déjà en cours, note une demande de re-passe sans lancer de 2e exécution concurrente.
 * - Exécute la passe suivante strictement après la fin de la passe en cours tant qu'il existe
 *   une demande de relance et des tâches éligibles (borné par `maxPasses`).
 */
export function createSerializedSyncRunner(maxPasses = 5) {
  let activePromise: Promise<SerializedSyncRunTotals | null> | null = null;
  let rescheduleRequested = false;

  return {
    isRunning: () => activePromise !== null,
    isRescheduleRequested: () => rescheduleRequested,
    run: (options: {
      canStart: () => boolean;
      runPass: () => Promise<SyncBatchSummary>;
      onStart?: () => void;
      onFinish?: (totals: SerializedSyncRunTotals) => void;
      onFinally?: () => void;
    }): Promise<SerializedSyncRunTotals | null> => {
      if (activePromise) {
        rescheduleRequested = true;
        return activePromise;
      }

      if (!options.canStart()) {
        return Promise.resolve(null);
      }

      activePromise = (async () => {
        options.onStart?.();
        const totals: SerializedSyncRunTotals = {
          syncedCount: 0,
          retryableFailedCount: 0,
          permanentFailedCount: 0,
          blockedByParentCount: 0,
          passesExecuted: 0,
        };

        try {
          do {
            rescheduleRequested = false;
            if (!options.canStart()) break;
            const summary = await options.runPass();
            totals.syncedCount += summary.syncedCount;
            totals.retryableFailedCount += summary.retryableFailedCount;
            totals.permanentFailedCount += summary.permanentFailedCount;
            totals.blockedByParentCount += summary.blockedByParentCount;
            totals.passesExecuted += 1;
          } while (rescheduleRequested && totals.passesExecuted < maxPasses);
        } finally {
          activePromise = null;
          rescheduleRequested = false;
          options.onFinally?.();
        }

        options.onFinish?.(totals);
        return totals;
      })();

      return activePromise;
    },
  };
}



