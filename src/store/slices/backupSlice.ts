import { create } from 'zustand';
import { useAuthStore } from './authSlice';
import { useCustomersStore } from './customersSlice';
import { useOrdersStore } from './ordersSlice';
import { useBudgetStore } from './budgetSlice';
import { useProductsStore } from './productsSlice';
import { useAgendaStore } from './agendaSlice';
import { useDailyLogsStore } from './dailyLogsSlice';
import { db } from '../../lib/firebase';
import { collection, getDocs, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { getPaths, handleFirestoreError, OperationType } from '../../lib/firestoreService';
import { DEFAULT_PROFILE } from '../../lib/profileHelpers';

interface BackupState {
  importBackupData: (data: any) => Promise<void>;
  hardResetData: () => Promise<void>;
}

export const useBackupStore = create<BackupState>(() => ({
  importBackupData: async (data) => {
    if (!data || typeof data !== 'object') {
      throw new Error('Données de sauvegarde invalides ou vides.');
    }

    const { user } = useAuthStore.getState();
    if (user) {
      const paths = getPaths(user.uid);

      // Import Profile
      if (data.profile) {
        try {
          await setDoc(
            doc(db, paths.user),
            {
              ...data.profile,
              themeMode: data.profile.themeMode || useAuthStore.getState().themeMode,
            },
            { merge: true }
          );
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, paths.user);
        }
      }

      // Import Customers
      if (data.customers && Array.isArray(data.customers)) {
        for (const cust of data.customers) {
          const custId = cust.id || 'cust_' + Math.random().toString(36).substr(2, 9);
          const cleanCust = { ...cust };
          delete cleanCust.id;
          try {
            await setDoc(doc(db, paths.customers, custId), {
              ...cleanCust,
              userId: user.uid,
              createdAt: cust.createdAt || new Date().toISOString(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, `${paths.customers}/${custId}`);
          }
        }
      }

      // Import Orders
      if (data.orders && Array.isArray(data.orders)) {
        for (const ord of data.orders) {
          const ordId = ord.id || 'ord_' + Math.random().toString(36).substr(2, 9);
          const cleanOrd = { ...ord };
          delete cleanOrd.id;
          try {
            await setDoc(doc(db, paths.orders, ordId), {
              ...cleanOrd,
              userId: user.uid,
              createdAt: ord.createdAt || new Date().toISOString(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, `${paths.orders}/${ordId}`);
          }
        }
      }

      // Import Budget
      if (data.budget && Array.isArray(data.budget)) {
        for (const entry of data.budget) {
          const entryId = entry.id || 'bud_' + Math.random().toString(36).substr(2, 9);
          const cleanEntry = { ...entry };
          delete cleanEntry.id;
          try {
            await setDoc(doc(db, paths.budget, entryId), {
              ...cleanEntry,
              userId: user.uid,
              createdAt: entry.createdAt || new Date().toISOString(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, `${paths.budget}/${entryId}`);
          }
        }
      }
    } else {
      if (data.customers) localStorage.setItem('fcf-customers', JSON.stringify(data.customers));
      if (data.orders) localStorage.setItem('fcf-orders', JSON.stringify(data.orders));
      if (data.budget) localStorage.setItem('fcf-budget', JSON.stringify(data.budget));
      if (data.profile) localStorage.setItem('fcf-profile', JSON.stringify(data.profile));
    }
  },

  hardResetData: async () => {
    const { user } = useAuthStore.getState();
    if (user) {
      const paths = getPaths(user.uid);
      try {
        const customers = useCustomersStore.getState().customers;
        for (const cust of customers) {
          await deleteDoc(doc(db, paths.customers, cust.id));
        }

        const orders = useOrdersStore.getState().orders;
        for (const ord of orders) {
          await deleteDoc(doc(db, paths.orders, ord.id));
        }

        const budget = useBudgetStore.getState().budget;
        for (const entry of budget) {
          await deleteDoc(doc(db, paths.budget, entry.id));
        }

        const agenda = useAgendaStore.getState().agendaList;
        for (const item of agenda) {
          await deleteDoc(doc(db, paths.agenda, item.id));
        }

        const dailySnap = await getDocs(collection(db, paths.dailyLogs));
        for (const d of dailySnap.docs) {
          await deleteDoc(doc(db, paths.dailyLogs, d.id));
        }

        const prodSnap = await getDocs(collection(db, paths.products));
        for (const d of prodSnap.docs) {
          await deleteDoc(doc(db, paths.products, d.id));
        }

        // firestore.rules denies delete on users/{uid}, so reset profile via setDoc
        await setDoc(
          doc(db, paths.user),
          {
            ...DEFAULT_PROFILE,
            name: user.displayName || '',
            companyEmail: user.email || '',
            photoUrl: user.photoURL || '',
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, paths.user);
      }
    }

    localStorage.removeItem('fcf-customers');
    localStorage.removeItem('fcf-orders');
    localStorage.removeItem('fcf-budget');
    localStorage.removeItem('fcf-simulated-offline');
    localStorage.removeItem('fcf-sync-queue');
    localStorage.removeItem('fcf-theme');
    localStorage.removeItem('fcf-profile');
    localStorage.removeItem('fcf-agenda');
    localStorage.removeItem('fcf-products');
    localStorage.removeItem('fcf-onboarding-completed');

    useCustomersStore.getState().setCustomers([]);
    useOrdersStore.getState().setOrders([]);
    useBudgetStore.getState().setBudget([]);
    useAgendaStore.getState().setAgendaList([]);
    useDailyLogsStore.getState().setDailyLogs([]);
    useProductsStore.getState().hardResetProducts();
  },
}));