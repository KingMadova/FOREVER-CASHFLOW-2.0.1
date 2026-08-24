import { create } from 'zustand';
import { DailyLog } from '../../types';
import { useAuthStore } from './authSlice';
import { db } from '../../lib/firebase';
import { collection, doc, setDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { getPaths, handleFirestoreError, OperationType } from '../../lib/firestoreService';

interface DailyLogsState {
  dailyLogs: DailyLog[];
  // Actions
  getDailyLog: (date: string) => DailyLog | undefined;
  saveDailyLog: (log: Partial<DailyLog> & { date: string }) => Promise<void>;
  setDailyLogs: (logs: DailyLog[]) => void;
  initializeListener: () => () => void;
}

export const useDailyLogsStore = create<DailyLogsState>((set, get) => ({
  dailyLogs: [],

  getDailyLog: (date) => {
    return get().dailyLogs.find((l) => l.date === date);
  },

  saveDailyLog: async (partial) => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    const path = getPaths(user.uid).dailyLogs;
    const id = partial.date; // ID = date YYYY-MM-DD, 1 doc par jour
    const existing = get().getDailyLog(partial.date);
    const now = new Date().toISOString();

    const log: DailyLog = {
      // Valeurs par défaut si nouveau log
      consumedProduct: false,
      trained: false,
      statusMorning: false,
      statusNoon: false,
      statusEvening: false,
      contactsAdded: 0,
      conversationsStarted: 0,
      followUpsDone: 0,
      oneToOne: 0,
      miniConferences: 0,
      conferences: 0,
      boutiques: 0,
      createdAt: now,
      // Écraser avec les valeurs existantes puis le patch
      ...existing,
      ...partial,
      id,
      userId: user.uid,
      updatedAt: now,
    };

    // Mise à jour optimiste locale immédiate
    set((state) => {
      const idx = state.dailyLogs.findIndex((l) => l.date === partial.date);
      if (idx >= 0) {
        const updated = [...state.dailyLogs];
        updated[idx] = log;
        return { dailyLogs: updated };
      }
      return { dailyLogs: [log, ...state.dailyLogs] };
    });

    try {
      await setDoc(doc(db, path, id), log);
    } catch (err) {
      console.error('saveDailyLog error:', err);
    }
  },

  setDailyLogs: (dailyLogs) => set({ dailyLogs }),

  initializeListener: () => {
    const { user } = useAuthStore.getState();
    if (!user) {
      set({ dailyLogs: [] });
      return () => {};
    }

    const paths = getPaths(user.uid);
    const unsub = onSnapshot(
      query(collection(db, paths.dailyLogs), orderBy('date', 'desc')),
      (snap) => {
        const data = snap.docs.map((d) => ({ ...d.data(), id: d.id } as DailyLog));
        set({ dailyLogs: data });
      },
      () => {} // Silent error for daily logs
    );

    return () => unsub();
  },
}));