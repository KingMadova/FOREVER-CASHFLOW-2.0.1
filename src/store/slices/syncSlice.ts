import { create } from 'zustand';
import { ProspectInteraction } from '../../types';
import { useAuthStore } from './authSlice';
import { getPaths } from '../../lib/firestoreService';
import {
  maxIsoDate,
  normalizeValidIsoDate,
  sanitizeInteractionForFirestore,
  stripInteractionsFromCustomerUpdatePayload,
} from '../../lib/prospectInteractions';
import {
  SyncTask,
  SIMULATED_OFFLINE_KEY,
  clearTaskErrorAndUnblockDependents,
  computeIsOfflineMode,
  createSerializedSyncRunner,
  dismissTaskWithDependents,
  executeSyncQueueBatch,
  hasPendingTaskForCustomer,
  isTaskEligibleForAutoSync,
  persistSyncQueue,
  recomputeCustomerAfterDismissedInteraction,
  readInitialSimulatedOffline,
  readInitialSyncQueue,
  upsertEntityTaskInQueue,
} from '../../lib/syncQueueHelpers';

export type { SyncTask };

function stripSyncedField(payload: any): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') return {};
  const { synced: _synced, ...rest } = payload;
  return rest;
}

interface SyncState {
  isOnline: boolean;
  isSimulatedOffline: boolean;
  syncQueue: SyncTask[];
  isSyncing: boolean;
  // Computed - champ dérivé maintenu par applyPatch (ne jamais setter directement)
  isOfflineMode: boolean;
  // Actions
  applyPatch: (patch: Partial<Pick<SyncState, 'isOnline' | 'isSimulatedOffline'>>) => void;
  setIsOnline: (online: boolean) => void;
  toggleSimulatedOffline: () => void;
  addToSyncQueue: (task: SyncTask) => void;
  upsertSyncTask: (task: SyncTask) => void;
  upsertOrderSyncTask: (task: SyncTask) => void;
  removeFromSyncQueue: (taskId: string) => void;
  setSyncQueue: (queue: SyncTask[]) => void;
  updateSyncQueue: (updater: (current: SyncTask[]) => SyncTask[]) => void;
  setIsSyncing: (syncing: boolean) => void;
  triggerSync: () => Promise<void>;
  retrySyncTask: (taskId: string) => Promise<void>;
  dismissSyncTask: (taskId: string) => Promise<void>;
  initializeNetworkListeners: () => () => void;
}

const initialOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
const initialSimulatedOffline = readInitialSimulatedOffline();

// Verrou module-level anti-concurrence et relance séquentielle pour triggerSync()
const syncRunner = createSerializedSyncRunner(5);

export const useSyncStore = create<SyncState>((set, get) => ({
  isOnline: initialOnline,
  isSimulatedOffline: initialSimulatedOffline,
  syncQueue: readInitialSyncQueue(),
  isSyncing: false,
  isOfflineMode: computeIsOfflineMode(initialOnline, initialSimulatedOffline),

  // Point d'entrée unique pour modifier isOnline/isSimulatedOffline :
  // recalcule isOfflineMode à chaque mutation.
  applyPatch: (patch) => {
    const next: Partial<Pick<SyncState, 'isOnline' | 'isSimulatedOffline' | 'isOfflineMode'>> = { ...patch };
    if ('isOnline' in next || 'isSimulatedOffline' in next) {
      const { isOnline, isSimulatedOffline } = get();
      const nextOnline = 'isOnline' in next ? Boolean(next.isOnline) : isOnline;
      const nextSimulated =
        'isSimulatedOffline' in next ? Boolean(next.isSimulatedOffline) : isSimulatedOffline;
      next.isOfflineMode = computeIsOfflineMode(nextOnline, nextSimulated);
    }
    set(next);
  },

  setIsOnline: (online) => get().applyPatch({ isOnline: online }),

  toggleSimulatedOffline: () => {
    const newValue = !get().isSimulatedOffline;
    get().applyPatch({ isSimulatedOffline: newValue });
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(SIMULATED_OFFLINE_KEY, newValue ? 'true' : 'false');
      } catch (e) {
        console.error(e);
      }
    }
    if (!newValue && get().isOnline && get().syncQueue.some(isTaskEligibleForAutoSync)) {
      void get().triggerSync();
    }
  },

  addToSyncQueue: (task) =>
    set((state) => {
      const next = upsertEntityTaskInQueue(state.syncQueue, task);
      persistSyncQueue(next);
      return { syncQueue: next };
    }),

  upsertSyncTask: (task) =>
    set((state) => {
      const next = upsertEntityTaskInQueue(state.syncQueue, task);
      persistSyncQueue(next);
      return { syncQueue: next };
    }),

  upsertOrderSyncTask: (task) =>
    set((state) => {
      const next = upsertEntityTaskInQueue(state.syncQueue, task);
      persistSyncQueue(next);
      return { syncQueue: next };
    }),

  removeFromSyncQueue: (taskId) =>
    set((state) => {
      const next = state.syncQueue.filter((t) => t.id !== taskId);
      persistSyncQueue(next);
      return { syncQueue: next };
    }),

  setSyncQueue: (queue) => {
    set({ syncQueue: queue });
    persistSyncQueue(queue);
  },

  updateSyncQueue: (updater) =>
    set((state) => {
      const next = updater(state.syncQueue);
      persistSyncQueue(next);
      return { syncQueue: next };
    }),

  setIsSyncing: (syncing) => set({ isSyncing: syncing }),

  retrySyncTask: async (taskId) => {
    set((state) => {
      const next = clearTaskErrorAndUnblockDependents(state.syncQueue, taskId);
      persistSyncQueue(next);
      return { syncQueue: next };
    });
    if (!get().isOfflineMode && get().syncQueue.some(isTaskEligibleForAutoSync)) {
      await get().triggerSync();
    }
  },

  dismissSyncTask: async (taskId) => {
    const target = get().syncQueue.find((t) => t.id === taskId);
    set((state) => {
      const next = dismissTaskWithDependents(state.syncQueue, taskId);
      persistSyncQueue(next);
      return { syncQueue: next };
    });

    if (!target) return;
    if (target.type === 'CUSTOMER' && target.actionType === 'ADD') {
      const { useCustomersStore } = await import('./customersSlice');
      useCustomersStore.getState().setCustomers(
        useCustomersStore.getState().customers.filter((c) => c.id !== target.entityId),
      );
    } else if (target.type === 'CUSTOMER_INTERACTION') {
      const customerId = target.payload?.customerId as string | undefined;
      if (customerId) {
        const { useCustomersStore } = await import('./customersSlice');
        const remainingQueue = get().syncQueue;
        useCustomersStore.getState().setCustomers(
          useCustomersStore.getState().customers.map((c) =>
            c.id === customerId
              ? recomputeCustomerAfterDismissedInteraction(c, target, remainingQueue)
              : c,
          ),
        );
      }
    } else if (target.type === 'CUSTOMER') {
      const { useCustomersStore } = await import('./customersSlice');
      const stillPending = hasPendingTaskForCustomer(get().syncQueue, target.entityId);
      useCustomersStore.getState().setCustomers(
        useCustomersStore.getState().customers.map((c) =>
          c.id === target.entityId ? { ...c, synced: !stillPending } : c,
        ),
      );
    }
  },

  triggerSync: async () => {
    await syncRunner.run({
      canStart: () => {
        const { syncQueue, isOfflineMode } = get();
        const { user } = useAuthStore.getState();
        return Boolean(user && !isOfflineMode && syncQueue.some(isTaskEligibleForAutoSync));
      },
      onStart: () => set({ isSyncing: true }),
      runPass: async () => {
        const activeUser = useAuthStore.getState().user;
        if (!activeUser || get().isOfflineMode) {
          return {
            syncedCount: 0,
            retryableFailedCount: 0,
            permanentFailedCount: 0,
            deferredCount: 0,
            blockedByParentCount: 0,
          };
        }

        const { db } = await import('../../lib/firebase');
        const { arrayUnion, deleteDoc, doc, runTransaction, setDoc, updateDoc } = await import(
          'firebase/firestore'
        );
        const { useCustomersStore } = await import('./customersSlice');
        const { useOrdersStore } = await import('./ordersSlice');
        const { useBudgetStore } = await import('./budgetSlice');
        const { useAgendaStore } = await import('./agendaSlice');
        const { useDailyLogsStore } = await import('./dailyLogsSlice');

        const paths = getPaths(activeUser.uid);

        return executeSyncQueueBatch({
            getQueue: () => get().syncQueue,
            setQueue: (updater) => {
              set((state) => {
                const next = updater(state.syncQueue);
                persistSyncQueue(next);
                return { syncQueue: next };
              });
            },
            isOffline: () => get().isOfflineMode,
            executeTask: async (task) => {
              const cleanPayload = stripSyncedField(task.payload);

              if (task.type === 'CUSTOMER') {
                if (task.actionType === 'DELETE') {
                  await deleteDoc(doc(db, paths.customers, task.entityId));
                } else if (task.actionType === 'UPDATE') {
                  const safePatch = stripInteractionsFromCustomerUpdatePayload(cleanPayload);
                  const customerRef = doc(db, paths.customers, task.entityId);
                  await runTransaction(db, async (tx) => {
                    const snap = await tx.get(customerRef);
                    if (!snap.exists()) {
                      const err = new Error(
                        "Le prospect/client cible n'existe plus sur Firestore.",
                      ) as Error & { code?: string };
                      err.code = 'not-found';
                      throw err;
                    }
                    const serverData = snap.data() as Record<string, unknown>;
                    const serverLast = normalizeValidIsoDate(
                      typeof serverData.lastContactDate === 'string'
                        ? serverData.lastContactDate
                        : '',
                    );
                    const candidateLast = normalizeValidIsoDate(
                      typeof safePatch.lastContactDate === 'string'
                        ? safePatch.lastContactDate
                        : '',
                    );
                    const nextLast = maxIsoDate(serverLast, candidateLast);
                    const finalPatch: Record<string, unknown> = { ...safePatch };
                    if (nextLast) {
                      finalPatch.lastContactDate = nextLast;
                    }
                    tx.update(customerRef, finalPatch);
                  });
                } else {
                  await setDoc(doc(db, paths.customers, task.entityId), cleanPayload);
                }
              } else if (task.type === 'CUSTOMER_INTERACTION') {
                const customerId = String(cleanPayload.customerId || '');
                const rawInteraction = cleanPayload.interaction as ProspectInteraction | undefined;
                if (!customerId || !rawInteraction || typeof rawInteraction !== 'object') {
                  const err = new Error(
                    "Données d'interaction incomplètes (customerId ou interaction manquant).",
                  ) as Error & { code?: string };
                  err.code = 'invalid-argument';
                  throw err;
                }
                const cleanInteraction = sanitizeInteractionForFirestore(rawInteraction);
                const customerRef = doc(db, paths.customers, customerId);
                await runTransaction(db, async (tx) => {
                  const snap = await tx.get(customerRef);
                  if (!snap.exists()) {
                    const err = new Error(
                      "Le prospect cible n'existe plus sur Firestore.",
                    ) as Error & { code?: string };
                    err.code = 'not-found';
                    throw err;
                  }
                  const serverData = snap.data() as Record<string, unknown>;
                  const serverLast = normalizeValidIsoDate(
                    typeof serverData.lastContactDate === 'string'
                      ? serverData.lastContactDate
                      : '',
                  );
                  const nextLast = maxIsoDate(serverLast, cleanInteraction.date);
                  const updateFields: Record<string, unknown> = {
                    interactions: arrayUnion(cleanInteraction),
                  };
                  if (nextLast && nextLast !== serverLast) {
                    updateFields.lastContactDate = nextLast;
                  }
                  tx.update(customerRef, updateFields);
                });
              } else if (task.type === 'ORDER') {
                if (task.actionType === 'DELETE') {
                  await deleteDoc(doc(db, paths.orders, task.entityId));
                } else if (task.actionType === 'UPDATE') {
                  await updateDoc(doc(db, paths.orders, task.entityId), cleanPayload);
                } else {
                  await setDoc(doc(db, paths.orders, task.entityId), cleanPayload);
                }
              } else if (task.type === 'BUDGET') {
                if (task.actionType === 'DELETE') {
                  await deleteDoc(doc(db, paths.budget, task.entityId));
                } else if (task.actionType === 'UPDATE') {
                  await updateDoc(doc(db, paths.budget, task.entityId), cleanPayload);
                } else {
                  await setDoc(doc(db, paths.budget, task.entityId), cleanPayload);
                }
              } else if (task.type === 'AGENDA') {
                if (task.actionType === 'DELETE') {
                  await deleteDoc(doc(db, paths.agenda, task.entityId));
                } else if (task.actionType === 'UPDATE') {
                  await updateDoc(doc(db, paths.agenda, task.entityId), cleanPayload);
                } else {
                  await setDoc(doc(db, paths.agenda, task.entityId), cleanPayload);
                }
              } else if (task.type === 'DAILY_LOG') {
                if (task.actionType === 'DELETE') {
                  await deleteDoc(doc(db, paths.dailyLogs, task.entityId));
                } else {
                  await setDoc(doc(db, paths.dailyLogs, task.entityId), cleanPayload, {
                    merge: true,
                  });
                }
              }
            },
            onTaskSynced: (task, updatedQueue) => {
              if (task.type === 'CUSTOMER' && task.actionType !== 'DELETE') {
                const stillPending = hasPendingTaskForCustomer(updatedQueue, task.entityId);
                useCustomersStore.getState().setCustomers(
                  useCustomersStore.getState().customers.map((c) =>
                    c.id === task.entityId ? { ...c, synced: !stillPending } : c,
                  ),
                );
              } else if (task.type === 'CUSTOMER_INTERACTION') {
                const customerId = String(task.payload?.customerId || '');
                if (customerId) {
                  const stillPending = hasPendingTaskForCustomer(updatedQueue, customerId);
                  useCustomersStore.getState().setCustomers(
                    useCustomersStore.getState().customers.map((c) =>
                      c.id === customerId ? { ...c, synced: !stillPending } : c,
                    ),
                  );
                }
              } else if (task.type === 'ORDER' && task.actionType !== 'DELETE') {
                useOrdersStore.getState().setOrders(
                  useOrdersStore.getState().orders.map((o) =>
                    o.id === task.entityId ? { ...o, synced: true } : o,
                  ),
                );
              } else if (task.type === 'BUDGET' && task.actionType !== 'DELETE') {
                useBudgetStore.getState().setBudget(
                  useBudgetStore.getState().budget.map((b) =>
                    b.id === task.entityId ? { ...b, synced: true } : b,
                  ),
                );
              } else if (task.type === 'AGENDA' && task.actionType !== 'DELETE') {
                useAgendaStore.getState().setAgendaList(
                  useAgendaStore.getState().agendaList.map((a) =>
                    a.id === task.entityId ? { ...a, synced: true } : a,
                  ),
                );
              } else if (task.type === 'DAILY_LOG' && task.actionType !== 'DELETE') {
                useDailyLogsStore.getState().setDailyLogs(
                  useDailyLogsStore.getState().dailyLogs.map((l) =>
                    l.id === task.entityId ? { ...l, synced: true } : l,
                  ),
                );
              }
            },
          });
      },
      onFinally: () => set({ isSyncing: false }),
      onFinish: (totals) => {
        void (async () => {
          const { useFeedbackStore } = await import('./feedbackSlice');
          if (totals.permanentFailedCount > 0 || totals.blockedByParentCount > 0) {
            useFeedbackStore.getState().notifyError(
              `Synchronisation bloquée : ${totals.permanentFailedCount} erreur${totals.permanentFailedCount > 1 ? 's' : ''} permanente${totals.permanentFailedCount > 1 ? 's' : ''}${totals.blockedByParentCount > 0 ? ` et ${totals.blockedByParentCount} interaction${totals.blockedByParentCount > 1 ? 's' : ''} bloquée${totals.blockedByParentCount > 1 ? 's' : ''}` : ''}. Ouvrez la file de synchronisation pour résoudre ou réessayer.`,
            );
          } else if (totals.retryableFailedCount > 0) {
            useFeedbackStore.getState().notifyError(
              `Synchronisation partielle : ${totals.retryableFailedCount} opération${totals.retryableFailedCount > 1 ? 's' : ''} en attente n’ont pas pu être enregistrées sur Firestore (nouvelle tentative automatique dès que le réseau sera stable).`,
            );
          } else if (totals.syncedCount > 0) {
            useFeedbackStore.getState().notifySuccess(
              `Synchronisation terminée (${totals.syncedCount} opération${totals.syncedCount > 1 ? 's' : ''} enregistrée${totals.syncedCount > 1 ? 's' : ''} sur Firestore).`,
            );
          }
        })();
      },
    });
  },

  initializeNetworkListeners: () => {
    const handleOnline = () => {
      get().setIsOnline(true);
      if (
        !get().isSimulatedOffline &&
        get().syncQueue.some(isTaskEligibleForAutoSync)
      ) {
        void get().triggerSync();
      }
    };
    const handleOffline = () => get().setIsOnline(false);

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  },
}));