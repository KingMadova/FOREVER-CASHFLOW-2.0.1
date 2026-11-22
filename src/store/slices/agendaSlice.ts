import { create } from 'zustand';
import { AgendaItem } from '../../types';
import { useAuthStore } from './authSlice';
import { db } from '../../lib/firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { getPaths, handleFirestoreError, OperationType } from '../../lib/firestoreService';
import { useSyncStore } from './syncSlice';
import { classifySyncError } from '../../lib/syncQueueHelpers';

interface AgendaState {
  agendaList: AgendaItem[];
  // Actions
  addAgendaItem: (
    item: Omit<AgendaItem, 'id' | 'completed'> & { id?: string }
  ) => Promise<'saved' | 'queued'>;
  updateAgendaItem: (item: AgendaItem) => Promise<'saved' | 'queued'>;
  deleteAgendaItem: (id: string) => Promise<'saved' | 'queued'>;
  toggleAgendaItemCompleted: (id: string) => Promise<'saved' | 'queued'>;
  setAgendaList: (list: AgendaItem[]) => void;
  initializeListener: () => () => void;
}

export const useAgendaStore = create<AgendaState>((set, get) => ({
  agendaList: [],

  addAgendaItem: async (item) => {
    const { user } = useAuthStore.getState();
    if (!user) {
      throw new Error('Utilisateur non authentifié. Veuillez vous reconnecter.');
    }

    const { isOfflineMode, upsertSyncTask } = useSyncStore.getState();
    const path = getPaths(user.uid).agenda;
    const { id: requestedId, ...itemFields } = item;
    const id = (requestedId || '').trim() || 'ag_' + Math.random().toString(36).substr(2, 9);

    if (get().agendaList.some((existing) => existing.id === id)) {
      const stillQueued = useSyncStore
        .getState()
        .syncQueue.some((t) => t.type === 'AGENDA' && t.entityId === id);
      return stillQueued ? 'queued' : 'saved';
    }

    const payload = {
      ...itemFields,
      userId: user.uid,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    const optimisticItem: AgendaItem = { ...payload, id, synced: !isOfflineMode };

    set((state) => ({ agendaList: [optimisticItem, ...state.agendaList] }));

    const enqueueAgendaAdd = () => {
      upsertSyncTask({
        id: 'sync_' + Math.random().toString(36).substr(2, 9),
        type: 'AGENDA',
        entityId: id,
        name: itemFields.title,
        actionType: 'ADD',
        payload,
        createdAt: new Date().toISOString(),
      });
    };

    if (isOfflineMode) {
      enqueueAgendaAdd();
      return 'queued';
    }

    try {
      await setDoc(doc(db, path, id), payload);
      return 'saved';
    } catch (err) {
      const classification = classifySyncError(err, {
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      });
      if (classification === 'RETRYABLE') {
        set((state) => ({
          agendaList: state.agendaList.map((a) => (a.id === id ? { ...a, synced: false } : a)),
        }));
        enqueueAgendaAdd();
        return 'queued';
      }
      set((state) => ({ agendaList: state.agendaList.filter((a) => a.id !== id) }));
      handleFirestoreError(err, OperationType.CREATE, `${path}/${id}`);
      throw err;
    }
  },

  updateAgendaItem: async (updated) => {
    const { user } = useAuthStore.getState();
    if (!user) {
      throw new Error('Utilisateur non authentifié. Veuillez vous reconnecter.');
    }

    const { isOfflineMode, upsertSyncTask } = useSyncStore.getState();
    const path = getPaths(user.uid).agenda;
    const prevList = get().agendaList;
    const { synced: _synced, ...withoutSynced } = updated as AgendaItem & { userId?: string };
    const toSave = {
      ...withoutSynced,
      userId: (updated as AgendaItem & { userId?: string }).userId || user.uid,
    };

    if (isOfflineMode) {
      set({
        agendaList: prevList.map((a) =>
          a.id === updated.id ? ({ ...toSave, synced: false } as AgendaItem) : a
        ),
      });
      upsertSyncTask({
        id: 'sync_' + Math.random().toString(36).substr(2, 9),
        type: 'AGENDA',
        entityId: updated.id,
        name: updated.title,
        actionType: 'UPDATE',
        payload: toSave,
        createdAt: new Date().toISOString(),
      });
      return 'queued';
    }

    set({
      agendaList: prevList.map((a) =>
        a.id === updated.id ? ({ ...toSave, synced: true } as AgendaItem) : a
      ),
    });

    try {
      await updateDoc(doc(db, path, updated.id), { ...toSave });
      return 'saved';
    } catch (err) {
      set({ agendaList: prevList });
      handleFirestoreError(err, OperationType.UPDATE, `${path}/${updated.id}`);
      throw err;
    }
  },

  deleteAgendaItem: async (id) => {
    const { user } = useAuthStore.getState();
    if (!user) {
      throw new Error('Utilisateur non authentifié. Veuillez vous reconnecter.');
    }

    const { isOfflineMode, upsertSyncTask } = useSyncStore.getState();
    const path = getPaths(user.uid).agenda;
    const prevList = get().agendaList;
    const target = prevList.find((a) => a.id === id);

    set({ agendaList: prevList.filter((a) => a.id !== id) });

    if (isOfflineMode) {
      upsertSyncTask({
        id: 'sync_' + Math.random().toString(36).substr(2, 9),
        type: 'AGENDA',
        entityId: id,
        name: target?.title || 'Rendez-vous',
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
      set({ agendaList: prevList });
      handleFirestoreError(err, OperationType.DELETE, `${path}/${id}`);
      throw err;
    }
  },

  toggleAgendaItemCompleted: async (id) => {
    const { user } = useAuthStore.getState();
    if (!user) {
      throw new Error('Utilisateur non authentifié. Veuillez vous reconnecter.');
    }

    const { isOfflineMode, upsertSyncTask } = useSyncStore.getState();
    const path = getPaths(user.uid).agenda;
    const prevList = get().agendaList;
    const item = prevList.find((a) => a.id === id);
    if (!item) {
      throw new Error('Rendez-vous introuvable.');
    }

    const nextCompleted = !item.completed;

    if (isOfflineMode) {
      set({
        agendaList: prevList.map((a) =>
          a.id === id ? { ...a, completed: nextCompleted, synced: false } : a
        ),
      });
      upsertSyncTask({
        id: 'sync_' + Math.random().toString(36).substr(2, 9),
        type: 'AGENDA',
        entityId: id,
        name: item.title,
        actionType: 'UPDATE',
        payload: { completed: nextCompleted },
        createdAt: new Date().toISOString(),
      });
      return 'queued';
    }

    set({
      agendaList: prevList.map((a) =>
        a.id === id ? { ...a, completed: nextCompleted, synced: true } : a
      ),
    });

    try {
      await updateDoc(doc(db, path, id), { completed: nextCompleted });
      return 'saved';
    } catch (err) {
      set({ agendaList: prevList });
      handleFirestoreError(err, OperationType.UPDATE, `${path}/${id}`);
      throw err;
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