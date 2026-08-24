import { create } from 'zustand';
import { BudgetEntry } from '../../types';
import { useAuthStore } from './authSlice';
import { db } from '../../lib/firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { getPaths, handleFirestoreError, OperationType } from '../../lib/firestoreService';

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
    try {
      await setDoc(doc(db, path, id), {
        ...entry,
        userId: user.uid,
        createdAt: entry.createdAt || new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  },

  updateBudgetEntry: async (updated) => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    const path = getPaths(user.uid).budget;
    try {
      await updateDoc(doc(db, path, updated.id), { ...updated });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${path}/${updated.id}`);
    }
  },

  deleteBudgetEntry: async (id) => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    const path = getPaths(user.uid).budget;
    try {
      await deleteDoc(doc(db, path, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${path}/${id}`);
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
      query(collection(db, paths.budget), orderBy('date', 'desc')),
      (snap) => {
        const data = snap.docs.map((d) => ({ ...d.data(), id: d.id } as BudgetEntry));
        set({ budget: data });
      },
      (err) => handleFirestoreError(err, OperationType.LIST, paths.budget)
    );

    return () => unsub();
  },
}));