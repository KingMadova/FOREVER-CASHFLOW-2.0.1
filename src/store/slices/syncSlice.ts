import { create } from 'zustand';
import { useAuthStore } from './authSlice';
import { getPaths } from '../../lib/firestoreService';

export interface SyncTask {
  id: string;
  type: 'CUSTOMER' | 'ORDER';
  entityId: string;
  name: string;
  actionType: 'ADD';
  payload: any;
  createdAt: string;
}

interface SyncState {
  isOnline: boolean;
  isSimulatedOffline: boolean;
  syncQueue: SyncTask[];
  isSyncing: boolean;
  // Computed
  isOfflineMode: boolean;
  // Actions
  setIsOnline: (online: boolean) => void;
  toggleSimulatedOffline: () => void;
  addToSyncQueue: (task: SyncTask) => void;
  removeFromSyncQueue: (taskId: string) => void;
  setSyncQueue: (queue: SyncTask[]) => void;
  setIsSyncing: (syncing: boolean) => void;
  triggerSync: () => Promise<void>;
  initializeNetworkListeners: () => () => void;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isSimulatedOffline: false,
  syncQueue: [],
  isSyncing: false,

  get isOfflineMode() {
    return !get().isOnline || get().isSimulatedOffline;
  },

  setIsOnline: (online) => set({ isOnline: online }),

  toggleSimulatedOffline: () => {
    const newValue = !get().isSimulatedOffline;
    set({ isSimulatedOffline: newValue });
    try {
      localStorage.setItem('fcf-simulated-offline', newValue ? 'true' : 'false');
    } catch (e) {
      console.error(e);
    }
  },

  addToSyncQueue: (task) => set((state) => ({ syncQueue: [...state.syncQueue, task] })),

  removeFromSyncQueue: (taskId) => set((state) => ({
    syncQueue: state.syncQueue.filter((t) => t.id !== taskId),
  })),

  setSyncQueue: (queue) => {
    set({ syncQueue: queue });
    try {
      localStorage.setItem('fcf-sync-queue', JSON.stringify(queue));
    } catch (e) {
      console.error(e);
    }
  },

  setIsSyncing: (syncing) => set({ isSyncing: syncing }),

  triggerSync: async () => {
    const { syncQueue, isSyncing, isOfflineMode } = get();
    const { user } = useAuthStore.getState();

    if (syncQueue.length === 0 || isSyncing || isOfflineMode || !user) return;

    set({ isSyncing: true });
    const tasksToProcess = [...syncQueue];
    const paths = getPaths(user.uid);

    // Import db dynamically to avoid circular deps
    const { db } = await import('../../lib/firebase');
    const { doc, setDoc } = await import('firebase/firestore');
    const { useCustomersStore } = await import('./customersSlice');
    const { useOrdersStore } = await import('./ordersSlice');

    for (const task of tasksToProcess) {
      try {
        if (task.type === 'CUSTOMER') {
          await setDoc(doc(db, paths.customers, task.entityId), task.payload);
          useCustomersStore.getState().setCustomers(
            useCustomersStore.getState().customers.map((c) =>
              c.id === task.entityId ? { ...c, synced: true } : c
            )
          );
        } else if (task.type === 'ORDER') {
          await setDoc(doc(db, paths.orders, task.entityId), task.payload);
          useOrdersStore.getState().setOrders(
            useOrdersStore.getState().orders.map((o) =>
              o.id === task.entityId ? { ...o, synced: true } : o
            )
          );
        }
        get().removeFromSyncQueue(task.id);
      } catch (err) {
        console.error('Sync failed for task', task.id, err);
      }
    }

    set({ isSyncing: false });
  },

  initializeNetworkListeners: () => {
    const handleOnline = () => get().setIsOnline(true);
    const handleOffline = () => get().setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  },
}));