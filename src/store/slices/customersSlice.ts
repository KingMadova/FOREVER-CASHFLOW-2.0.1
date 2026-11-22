import { create } from 'zustand';
import { Customer, ProspectInteraction } from '../../types';
import { useAuthStore } from './authSlice';
import { useSyncStore } from './syncSlice';
import { db } from '../../lib/firebase';
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
} from 'firebase/firestore';
import { getPaths, handleFirestoreError, OperationType } from '../../lib/firestoreService';
import {
  CreateProspectInteractionInput,
  buildProspectInteraction,
  maxIsoDate,
  mergeInteractionsUnique,
  normalizeValidIsoDate,
  stripInteractionsFromCustomerUpdatePayload,
} from '../../lib/prospectInteractions';
import {
  classifySyncError,
  hasPendingCustomerAdd,
  hasPendingTaskForCustomer,
  reconcileCustomersWithSyncQueue,
  removeAllTasksForCustomer,
} from '../../lib/syncQueueHelpers';

interface CustomersState {
  customers: Customer[];
  // Actions
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt'>) => Promise<'saved' | 'queued'>;
  updateCustomer: (customer: Customer) => Promise<'saved' | 'queued'>;
  addProspectInteraction: (
    customerId: string,
    input: CreateProspectInteractionInput,
  ) => Promise<'saved' | 'queued'>;
  deleteCustomer: (id: string) => Promise<'saved' | 'queued'>;
  setCustomers: (customers: Customer[]) => void;
  initializeListener: () => () => void;
}

export const useCustomersStore = create<CustomersState>((set, get) => ({
  customers: [],

  addCustomer: async (cust) => {
    const { user } = useAuthStore.getState();
    if (!user) {
      throw new Error('Utilisateur non authentifié. Veuillez vous reconnecter.');
    }

    const { isOfflineMode, upsertSyncTask } = useSyncStore.getState();
    const path = getPaths(user.uid).customers;
    const id = 'cust_' + Math.random().toString(36).substr(2, 9);
    const newCust = {
      ...cust,
      userId: user.uid,
      createdAt: new Date().toISOString().split('T')[0],
    };

    const prevCustomers = get().customers;
    const optimisticItem = { ...newCust, id, synced: !isOfflineMode } as Customer;

    if (isOfflineMode) {
      set({ customers: [optimisticItem, ...prevCustomers] });
      upsertSyncTask({
        id: 'sync_' + Math.random().toString(36).substr(2, 9),
        type: 'CUSTOMER',
        entityId: id,
        name: cust.name,
        actionType: 'ADD',
        payload: newCust,
        createdAt: new Date().toISOString(),
      });
      return 'queued';
    }

    set({ customers: [optimisticItem, ...prevCustomers] });

    try {
      await setDoc(doc(db, path, id), newCust);
      return 'saved';
    } catch (err) {
      set({ customers: prevCustomers });
      handleFirestoreError(err, OperationType.CREATE, `${path}/${id}`);
      throw err;
    }
  },

  updateCustomer: async (updated) => {
    const { user } = useAuthStore.getState();
    if (!user) {
      throw new Error('Utilisateur non authentifié. Veuillez vous reconnecter.');
    }

    const { isOfflineMode, upsertSyncTask, syncQueue } = useSyncStore.getState();
    const path = getPaths(user.uid).customers;
    const prevCustomers = get().customers;
    const existingCustomer = prevCustomers.find((c) => c.id === updated.id);

    const { synced: _synced, ...withoutSynced } = updated as Customer & { userId?: string };
    // Ne jamais écraser le journal d'interactions lors d'une tâche CUSTOMER UPDATE
    const safePatch = stripInteractionsFromCustomerUpdatePayload(withoutSynced);
    const monotonicLastContact =
      maxIsoDate(
        existingCustomer?.lastContactDate,
        updated.lastContactDate,
        ...(existingCustomer?.interactions || []).map((i) => i.date),
      ) || updated.lastContactDate;

    const toSave = {
      ...safePatch,
      lastContactDate: monotonicLastContact,
      userId: (updated as Customer & { userId?: string }).userId || user.uid,
    };

    const preservedInteractions = existingCustomer?.interactions ?? updated.interactions;
    const localUpdated: Customer = {
      ...(toSave as Customer),
      ...(preservedInteractions ? { interactions: preservedInteractions } : {}),
    };

    const mustQueueForParentAdd = hasPendingCustomerAdd(syncQueue, updated.id);

    const enqueueCustomerUpdate = () => {
      upsertSyncTask({
        id: 'sync_' + Math.random().toString(36).substr(2, 9),
        type: 'CUSTOMER',
        entityId: updated.id,
        name: updated.name,
        actionType: 'UPDATE',
        payload: toSave,
        createdAt: new Date().toISOString(),
      });
    };

    if (isOfflineMode || mustQueueForParentAdd) {
      set((state) => ({
        customers: state.customers.map((c) =>
          c.id === updated.id ? ({ ...localUpdated, synced: false } as Customer) : c,
        ),
      }));
      enqueueCustomerUpdate();
      if (mustQueueForParentAdd && !isOfflineMode) {
        const parentAdd = syncQueue.find(
          (t) => t.type === 'CUSTOMER' && t.actionType === 'ADD' && t.entityId === updated.id,
        );
        if (parentAdd && !parentAdd.permanentError) {
          void useSyncStore.getState().triggerSync();
        }
      }
      return 'queued';
    }

    const hasOtherPending = hasPendingTaskForCustomer(syncQueue, updated.id);
    set((state) => ({
      customers: state.customers.map((c) =>
        c.id === updated.id ? ({ ...localUpdated, synced: !hasOtherPending } as Customer) : c,
      ),
    }));

    try {
      const customerRef = doc(db, path, updated.id);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(customerRef);
        if (!snap.exists()) {
          const notFoundErr = new Error(
            "Le prospect/client cible n'existe plus sur Firestore.",
          ) as Error & { code?: string };
          notFoundErr.code = 'not-found';
          throw notFoundErr;
        }
        const serverData = snap.data() as Record<string, unknown>;
        const serverLast = normalizeValidIsoDate(
          typeof serverData.lastContactDate === 'string' ? serverData.lastContactDate : '',
        );
        const nextLast = maxIsoDate(serverLast, toSave.lastContactDate);
        const finalPatch: Record<string, unknown> = { ...toSave };
        if (nextLast) {
          finalPatch.lastContactDate = nextLast;
        }
        tx.update(customerRef, finalPatch);
      });
      return 'saved';
    } catch (err) {
      const classification = classifySyncError(err, {
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
        hasPendingParentAdd: hasPendingCustomerAdd(useSyncStore.getState().syncQueue, updated.id),
      });

      if (classification === 'RETRYABLE') {
        set((state) => ({
          customers: state.customers.map((c) =>
            c.id === updated.id ? ({ ...localUpdated, synced: false } as Customer) : c,
          ),
        }));
        enqueueCustomerUpdate();
        return 'queued';
      }

      if (existingCustomer) {
        set((state) => ({
          customers: state.customers.map((c) => (c.id === updated.id ? existingCustomer : c)),
        }));
      }
      handleFirestoreError(err, OperationType.UPDATE, `${path}/${updated.id}`);
      throw err;
    }
  },

  addProspectInteraction: async (customerId, input) => {
    const { user } = useAuthStore.getState();
    if (!user) {
      throw new Error('Utilisateur non authentifié. Veuillez vous reconnecter.');
    }

    const prevCustomers = get().customers;
    const target = prevCustomers.find((c) => c.id === customerId);
    if (!target) {
      throw new Error('Prospect introuvable.');
    }

    const requestedId = (input.id || '').trim();
    if (requestedId) {
      const currentQueue = useSyncStore.getState().syncQueue;
      const queuedSameId = currentQueue.some(
        (t) => t.type === 'CUSTOMER_INTERACTION' && t.entityId === requestedId,
      );
      if (queuedSameId) {
        return 'queued';
      }
      const alreadyOnTarget = (target.interactions || []).some((i) => i.id === requestedId);
      if (alreadyOnTarget) {
        return 'saved';
      }
    }

    const previousLastContactDate = target.lastContactDate;
    const interaction: ProspectInteraction = buildProspectInteraction(input);
    const { isOfflineMode, upsertSyncTask, syncQueue } = useSyncStore.getState();
    const path = getPaths(user.uid).customers;
    const parentAddTask = syncQueue.find(
      (t) => t.type === 'CUSTOMER' && t.actionType === 'ADD' && t.entityId === customerId,
    );
    const hasParentAdd = Boolean(parentAddTask);

    const applyLocalInteraction = (syncedFlag: boolean) => {
      set((state) => ({
        customers: state.customers.map((c) => {
          if (c.id !== customerId) return c;
          const merged = mergeInteractionsUnique(c.interactions, [interaction]);
          const nextLast =
            maxIsoDate(c.lastContactDate, interaction.date, ...merged.map((i) => i.date)) ||
            c.lastContactDate;
          return {
            ...c,
            interactions: merged,
            lastContactDate: nextLast,
            synced: syncedFlag,
          };
        }),
      }));
    };

    const enqueueInteractionTask = (blockedParent?: typeof parentAddTask) => {
      upsertSyncTask({
        id: 'sync_' + Math.random().toString(36).substr(2, 9),
        type: 'CUSTOMER_INTERACTION',
        entityId: interaction.id,
        name: target.name,
        actionType: 'ADD',
        payload: {
          customerId,
          interaction,
          ...(previousLastContactDate ? { previousLastContactDate } : {}),
        },
        createdAt: new Date().toISOString(),
        ...(blockedParent?.permanentError
          ? {
              blockedByTaskId: blockedParent.id,
              blockedReason: `Création du prospect "${blockedParent.name}" en erreur permanente : ${blockedParent.lastError || 'erreur inconnue'}`,
            }
          : {}),
      });
    };

    if (isOfflineMode || hasParentAdd) {
      applyLocalInteraction(false);
      enqueueInteractionTask(parentAddTask);
      if (hasParentAdd && !isOfflineMode && parentAddTask && !parentAddTask.permanentError) {
        // Relance séquentielle : s'exécute strictement après la passe CUSTOMER ADD en cours.
        void useSyncStore.getState().triggerSync();
      }
      return 'queued';
    }

    applyLocalInteraction(true);

    try {
      const customerRef = doc(db, path, customerId);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(customerRef);
        if (!snap.exists()) {
          const notFoundErr = new Error(
            "Le prospect cible n'existe plus sur Firestore.",
          ) as Error & { code?: string };
          notFoundErr.code = 'not-found';
          throw notFoundErr;
        }
        const serverData = snap.data() as Record<string, unknown>;
        const serverLast = normalizeValidIsoDate(
          typeof serverData.lastContactDate === 'string' ? serverData.lastContactDate : '',
        );
        const nextLast = maxIsoDate(serverLast, interaction.date);
        const updateFields: Record<string, unknown> = {
          interactions: arrayUnion(interaction),
        };
        if (nextLast && nextLast !== serverLast) {
          updateFields.lastContactDate = nextLast;
        }
        tx.update(customerRef, updateFields);
      });
      return 'saved';
    } catch (err) {
      const classification = classifySyncError(err, {
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
        hasPendingParentAdd: false,
      });

      if (classification === 'RETRYABLE') {
        // Bascule déterministe vers syncQueue avec exactement le même objet figé (zéro perte, zéro doublon).
        applyLocalInteraction(false);
        enqueueInteractionTask();
        return 'queued';
      }

      set((state) => ({
        customers: state.customers.map((c) => (c.id === customerId ? target : c)),
      }));
      handleFirestoreError(err, OperationType.UPDATE, `${path}/${customerId}`);
      throw err;
    }
  },

  deleteCustomer: async (id) => {
    const { user } = useAuthStore.getState();
    if (!user) {
      throw new Error('Utilisateur non authentifié. Veuillez vous reconnecter.');
    }

    const { isOfflineMode, upsertSyncTask, updateSyncQueue } = useSyncStore.getState();
    const path = getPaths(user.uid).customers;
    const target = get().customers.find((c) => c.id === id);

    set((state) => ({ customers: state.customers.filter((c) => c.id !== id) }));

    if (isOfflineMode) {
      upsertSyncTask({
        id: 'sync_' + Math.random().toString(36).substr(2, 9),
        type: 'CUSTOMER',
        entityId: id,
        name: target?.name || 'Client',
        actionType: 'DELETE',
        payload: {},
        createdAt: new Date().toISOString(),
      });
      return 'queued';
    }

    try {
      await deleteDoc(doc(db, path, id));
      // Uniquement après confirmation Firestore : purge fonctionnelle de toutes les tâches (ADD, UPDATE, CUSTOMER_INTERACTION)
      updateSyncQueue((current) => removeAllTasksForCustomer(current, id));
      return 'saved';
    } catch (err) {
      if (target) {
        set((state) => ({
          customers: state.customers.some((c) => c.id === id)
            ? state.customers
            : [target, ...state.customers],
        }));
      }
      handleFirestoreError(err, OperationType.DELETE, `${path}/${id}`);
      throw err;
    }
  },

  setCustomers: (customers) => set({ customers }),

  initializeListener: () => {
    const { user } = useAuthStore.getState();
    if (!user) {
      set({ customers: [] });
      return () => {};
    }

    // Hydratation immédiate depuis syncQueue avant même la première émission onSnapshot (ex. démarrage hors-ligne)
    const initialQueue = useSyncStore.getState().syncQueue;
    if (initialQueue.length > 0) {
      set((state) => ({
        customers: reconcileCustomersWithSyncQueue(state.customers, initialQueue),
      }));
    }

    const paths = getPaths(user.uid);
    const unsub = onSnapshot(
      query(collection(db, paths.customers), orderBy('createdAt', 'desc')),
      (snap) => {
        const data = snap.docs.map((d) => ({ ...d.data(), id: d.id } as Customer));
        const reconciled = reconcileCustomersWithSyncQueue(
          data,
          useSyncStore.getState().syncQueue,
        );
        set({ customers: reconciled });
      },
      (err) => handleFirestoreError(err, OperationType.LIST, paths.customers),
    );

    return () => unsub();
  },
}));