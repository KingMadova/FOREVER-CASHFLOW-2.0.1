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
  addBudgetEntry: (entry: Omit<BudgetEntry, 'id'>) => Promise<void>;
  updateBudgetEntry: (entry: BudgetEntry) => Promise<void>;
  deleteBudgetEntry: (id: string) => Promise<void>;
  setBudget: (budget: BudgetEntry[]) => void;
  initializeListener: () => () => void;
}

export const useBudgetStore = create<BudgetState>((set, get) => ({
  budget: [],

  addBudgetEntry: async (entry) => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    const path = getPaths(user.uid).budget;
    const id = 'bud_' + Math.random().toString(36).substr(2, 9);
    const full: BudgetEntry = {
      ...entry,
      id,
      userId: user.uid,
      createdAt: entry.createdAt || new Date().toISOString(),
      synced: true,
    };

    // Mise à jour optimiste : visible immédiatement dans l'UI
    set((state) => ({ budget: [full, ...state.budget] }));

    try {
      await setDoc(doc(db, path, id), {
        ...entry,
        userId: user.uid,
        createdAt: full.createdAt,
      });
    } catch (err) {
      console.error('[addBudgetEntry] Ecriture Firestore impossible, mise en file de sync:', err);
      useSyncStore.getState().addToSyncQueue({
        id: 'sync_' + Math.random().toString(36).substr(2, 9),
        type: 'BUDGET',
        entityId: id,
        name: `${entry.type === 'REVENUE' ? '+' : '-'}${entry.amount} F ${entry.category}`,
        actionType: 'ADD',
        payload: { ...entry, userId: user.uid, createdAt: full.createdAt },
        createdAt: new Date().toISOString(),
      });
      // Marquer localement comme non synchronisé
      set((state) => ({
        budget: state.budget.map((b) => (b.id === id ? { ...b, synced: false } : b)),
      }));
    }
  },

  updateBudgetEntry: async (updated) => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    const path = getPaths(user.uid).budget;

    // Optimiste
    const prev = get().budget;
    set((state) => ({
      budget: state.budget.map((b) => (b.id === updated.id ? updated : b)),
    }));

    try {
      const { synced, ...toSave } = updated;
      await updateDoc(doc(db, path, updated.id), toSave);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${path}/${updated.id}`);
      set({ budget: prev }); // rollback si échec
    }
  },

  deleteBudgetEntry: async (id) => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    const path = getPaths(user.uid).budget;

    // Optimiste
    const prev = get().budget;
    set((state) => ({ budget: state.budget.filter((b) => b.id !== id) }));

    try {
      await deleteDoc(doc(db, path, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${path}/${id}`);
      set({ budget: prev }); // rollback si échec
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
      // Pas de orderBy serveur : Firestore exclut silencieusement les documents
      // sans le champ trié. La vue trie déjà côté client par date décroissante.
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
