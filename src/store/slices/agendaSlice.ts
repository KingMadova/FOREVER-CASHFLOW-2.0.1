import { create } from 'zustand';
import { AgendaItem } from '../../types';
import { useAuthStore } from './authSlice';
import { db } from '../../lib/firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { getPaths, handleFirestoreError, OperationType } from '../../lib/firestoreService';

interface AgendaState {
  agendaList: AgendaItem[];
  // Actions
  addAgendaItem: (item: Omit<AgendaItem, 'id' | 'completed'>) => Promise<void>;
  updateAgendaItem: (item: AgendaItem) => Promise<void>;
  deleteAgendaItem: (id: string) => Promise<void>;
  toggleAgendaItemCompleted: (id: string) => Promise<void>;
  setAgendaList: (list: AgendaItem[]) => void;
  initializeListener: () => () => void;
}

export const useAgendaStore = create<AgendaState>((set, get) => ({
  agendaList: [],

  addAgendaItem: async (item) => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    const path = getPaths(user.uid).agenda;
    const id = 'ag_' + Math.random().toString(36).substr(2, 9);
    try {
      await setDoc(doc(db, path, id), {
        ...item,
        userId: user.uid,
        completed: false,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  },

  updateAgendaItem: async (updated) => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    const path = getPaths(user.uid).agenda;
    try {
      await updateDoc(doc(db, path, updated.id), { ...updated });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${path}/${updated.id}`);
    }
  },

  deleteAgendaItem: async (id) => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    const path = getPaths(user.uid).agenda;
    try {
      await deleteDoc(doc(db, path, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${path}/${id}`);
    }
  },

  toggleAgendaItemCompleted: async (id) => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    const path = getPaths(user.uid).agenda;
    const item = get().agendaList.find((a) => a.id === id);
    if (!item) return;

    try {
      await updateDoc(doc(db, path, id), { completed: !item.completed });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${path}/${id}`);
    }
  },

  setAgendaList: (agendaList) => set({ agendaList }),

  initializeListener: () => {
    const { user } = useAuthStore.getState();
    if (!user) {
      set({ agendaList: [] });
      return () => {};
    }

    const paths = getPaths(user.uid);
    const unsub = onSnapshot(
      query(collection(db, paths.agenda), orderBy('date', 'desc')),
      (snap) => {
        const data = snap.docs.map((d) => ({ ...d.data(), id: d.id } as AgendaItem));
        set({ agendaList: data });
      },
      (err) => handleFirestoreError(err, OperationType.LIST, paths.agenda)
    );

    return () => unsub();
  },
}));