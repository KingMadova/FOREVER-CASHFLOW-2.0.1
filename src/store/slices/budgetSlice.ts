import { create } from 'zustand';
import { BudgetEntry } from '../../types';
import { useAuthStore } from './authSlice';
import { db } from '../../lib/firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { getPaths, handleFirestoreError, OperationType } from '../../lib/firestoreService';
import { useSyncStore } from './syncSlice';

interface BudgetState {
  budget: BudgetEntry[];
  // Actions
  addBudgetEntry: (entry: Omit<BudgetEntry, 'id'>) => Promise<'saved' | 'queued'>;
  updateBudgetEntry: (entry: BudgetEntry) => Promise<'saved' | 'queued'>;
  deleteBudgetEntry: (id: string) => Promise<'saved' | 'queued'>;
  setBudget: (budget: BudgetEntry[]) => void;
  initializeListener: () => () => void;
}

export const useBudgetStore = create<BudgetState>((set, get) => ({
  budget: [],

  addBudgetEntry: async (entry) => {
    const { user } = useAuthStore.getState();
    if (!user) {
      throw new Error('Utilisateur non authentifié. Veuillez vous reconnecter.');
    }

    const { isOfflineMode, upsertSyncTask } = useSyncStore.getState();
    const path = getPaths(user.uid).budget;
    const id = 'bud_' + Math.random().toString(36).substr(2, 9);
    const createdAt = entry.createdAt || new Date().toISOString();
    const full: BudgetEntry = {
      ...entry,
      id,
      userId: user.uid,
      createdAt,
      synced: !isOfflineMode,
    };

    const prevBudget = get().budget;

    if (isOfflineMode) {
      set({ budget: [full, ...prevBudget] });
      upsertSyncTask({
        id: 'sync_' + Math.random().toString(36).substr(2, 9),
        type: 'BUDGET',
        entityId: id,
        name: `${entry.type === 'REVENUE' ? '+' : '-'}${entry.amount} F ${entry.category}`,
        actionType: 'ADD',
        payload: { ...entry, userId: user.uid, createdAt },
        createdAt: new Date().toISOString(),
      });
      return 'queued';
    }

    set({ budget: [full, ...prevBudget] });

    try {
      await setDoc(doc(db, path, id), {
        ...entry,
        userId: user.uid,
        createdAt,
      });
      return 'saved';
    } catch (err) {
      set({ budget: prevBudget });
      handleFirestoreError(err, OperationType.CREATE, `${path}/${id}`);
      throw err;
    }
  },

  updateBudgetEntry: async (updated) => {
    const { user } = useAuthStore.getState();
    if (!user) {
      throw new Error('Utilisateur non authentifié. Veuillez vous reconnecter.');
    }

    const { isOfflineMode, upsertSyncTask } = useSyncStore.getState();
    const path = getPaths(user.uid).budget;
    const prev = get().budget;
    const { synced: _synced, ...withoutSynced } = updated;
    const toSave = {
      ...withoutSynced,
      userId: withoutSynced.userId || user.uid,
    };

    if (isOfflineMode) {
      set({
        budget: prev.map((b) => (b.id === updated.id ? { ...toSave, synced: false } : b)),
      });
      upsertSyncTask({
        id: 'sync_' + Math.random().toString(36).substr(2, 9),
        type: 'BUDGET',
        entityId: updated.id,
        name: `${updated.type === 'REVENUE' ? '+' : '-'}${updated.amount} F ${updated.category}`,
        actionType: 'UPDATE',
        payload: toSave,
        createdAt: new Date().toISOString(),
      });
      return 'queued';
    }

    set({
      budget: prev.map((b) => (b.id === updated.id ? { ...toSave, synced: true } : b)),
    });

    try {
      await updateDoc(doc(db, path, updated.id), toSave);
      return 'saved';
    } catch (err) {
      set({ budget: prev });
      handleFirestoreError(err, OperationType.UPDATE, `${path}/${updated.id}`);
      throw err;
    }
  },

  deleteBudgetEntry: async (id) => {
    const { user } = useAuthStore.getState();
    if (!user) {
      throw new Error('Utilisateur non authentifié. Veuillez vous reconnecter.');
    }

    const { isOfflineMode, upsertSyncTask } = useSyncStore.getState();
    const path = getPaths(user.uid).budget;
    const prev = get().budget;
    const target = prev.find((b) => b.id === id);

    set({ budget: prev.filter((b) => b.id !== id) });

    if (isOfflineMode) {
      upsertSyncTask({
        id: 'sync_' + Math.random().toString(36).substr(2, 9),
        type: 'BUDGET',
        entityId: id,
        name: target ? `${target.category} (${target.amount} F)` : 'Mouvement budget',
        actionType: 'DELETE',
        payload: {},
        createdAt: new Date().toISOString(),
      });
      return 'queued';
    }

    try {
      await deleteDoc(doc(db, path, id));
      return 'saved';
    } catch (err) {
      set({ budget: prev });
      handleFirestoreError(err, OperationType.DELETE, `${path}/${id}`);
      throw err;
    }
  },

  setBudget: (budget) => set({ budget }),

  initializeListener: () => {
    const { user } = useAuthStore.getState();
    if (!user) {
      set({ budget: [] });
      return () => {};
    }

    const paths = getPaths(user.uid);
    const unsub = onSnapshot(
      collection(db, paths.budget),
      (snap) => {
        const data = snap.docs.map((d) => ({ ...d.data(), id: d.id } as BudgetEntry));
        set({ budget: data });
      },
      (err) => handleFirestoreError(err, OperationType.LIST, paths.budget)
    );

    return () => unsub();
  },
}));
