import { create } from 'zustand';
import { Customer } from '../../types';
import { useAuthStore } from './authSlice';
import { useSyncStore } from './syncSlice';
import { db } from '../../lib/firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { getPaths, handleFirestoreError, OperationType } from '../../lib/firestoreService';

interface CustomersState {
  customers: Customer[];
  // Actions
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt'>) => Promise<void>;
  updateCustomer: (customer: Customer) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  setCustomers: (customers: Customer[]) => void;
  initializeListener: () => () => void;
}

export const useCustomersStore = create<CustomersState>((set, get) => ({
  customers: [],

  addCustomer: async (cust) => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    const { isOfflineMode } = useSyncStore.getState();
    const path = getPaths(user.uid).customers;
    const id = 'cust_' + Math.random().toString(36).substr(2, 9);
    const newCust = {
      ...cust,
      userId: user.uid,
      createdAt: new Date().toISOString().split('T')[0],
    };

    // Optimistic update
    set((state) => ({
      customers: [...state.customers, { ...newCust, id, synced: !isOfflineMode } as Customer],
    }));

    try {
      await setDoc(doc(db, path, id), newCust);
    } catch (err) {
      // Offline: queue for sync
      useSyncStore.getState().addToSyncQueue({
        id: 'sync_' + Math.random().toString(36).substr(2, 9),
        type: 'CUSTOMER',
        entityId: id,
        name: cust.name,
        actionType: 'ADD',
        payload: newCust,
        createdAt: new Date().toISOString(),
      });
    }
  },

  updateCustomer: async (updated) => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    const path = getPaths(user.uid).customers;
    try {
      await updateDoc(doc(db, path, updated.id), { ...updated });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${path}/${updated.id}`);
    }
  },

  deleteCustomer: async (id) => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    const path = getPaths(user.uid).customers;
    try {
      await deleteDoc(doc(db, path, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${path}/${id}`);
    }
  },

  setCustomers: (customers) => set({ customers }),

  initializeListener: () => {
    const { user } = useAuthStore.getState();
    if (!user) {
      set({ customers: [] });
      return () => {};
    }

    const paths = getPaths(user.uid);
    const unsub = onSnapshot(
      query(collection(db, paths.customers), orderBy('createdAt', 'desc')),
      (snap) => {
        const data = snap.docs.map((d) => ({ ...d.data(), id: d.id } as Customer));
        set({ customers: data });
      },
      (err) => handleFirestoreError(err, OperationType.LIST, paths.customers)
    );

    return () => unsub();
  },
}));