import { create } from 'zustand';
import { Order } from '../../types';
import { useAuthStore } from './authSlice';
import { useSyncStore } from './syncSlice';
import { db } from '../../lib/firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { getPaths, handleFirestoreError, OperationType } from '../../lib/firestoreService';
import { useBudgetStore } from './budgetSlice';
import { isCountedStatus, localDateISO } from '../../lib/orderStats';
import {
  calculateLivraisonFrais,
  applyGeste,
  createOrderFromCart,
} from '../../lib/orderCalculations';

export { calculateLivraisonFrais, createOrderFromCart };

function generateRefCommande(existingOrders: Order[]): string {
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const sequence = (
    existingOrders.filter(
      (o) => typeof o.refCommande === 'string' && o.refCommande.startsWith(`CMD-${today}`)
    ).length + 1
  )
    .toString()
    .padStart(3, '0');
  return `CMD-${today}-${sequence}`;
}

interface OrdersState {
  orders: Order[];
  // Actions
  addOrder: (order: Omit<Order, 'id'>) => Promise<'saved' | 'queued'>;
  updateOrder: (order: Order) => Promise<'saved' | 'queued'>;
  deleteOrder: (id: string) => Promise<'saved' | 'queued'>;
  setOrders: (orders: Order[]) => void;
  initializeListener: () => () => void;
}

export const useOrdersStore = create<OrdersState>((set, get) => ({
  orders: [],

  addOrder: async (ord) => {
    const { user } = useAuthStore.getState();
    if (!user) {
      throw new Error('Utilisateur non authentifié. Veuillez vous reconnecter.');
    }

    const { isOfflineMode, addToSyncQueue } = useSyncStore.getState();
    const paths = getPaths(user.uid);
    const id = 'ord_' + Math.random().toString(36).substr(2, 9);

    const refCommande = generateRefCommande(get().orders);
    const livraisonFrais = calculateLivraisonFrais(ord.totalRetail, ord.livraison.mode);

    const newOrd = {
      ...ord,
      userId: user.uid,
      createdAt: new Date().toISOString(),
      refCommande,
      livraison: { ...ord.livraison, frais: livraisonFrais },
      distributeurId: ord.distributeurId || user.uid,
      tags: ord.tags || [],
      satisfaction: ord.satisfaction,
      satisfactionNote: ord.satisfactionNote,
      satisfactionDate: ord.satisfactionDate,
      recommandation: ord.recommandation || false,
      recommandationClientId: ord.recommandationClientId,
      delaiLivraison: ord.delaiLivraison,
    };

    // Appliquer uniquement les gestes commerciaux ; le coût d'achat officiel est déjà figé par ligne.
    const withGeste = applyGeste(newOrd);

    const prevOrders = get().orders;
    const optimisticOrder = { ...withGeste, id, synced: !isOfflineMode } as Order;

    if (isOfflineMode) {
      set({ orders: [...prevOrders, optimisticOrder] });
      addToSyncQueue({
        id: 'sync_' + Math.random().toString(36).substr(2, 9),
        type: 'ORDER',
        entityId: id,
        name: ord.customerName,
        actionType: 'ADD',
        payload: withGeste,
        createdAt: new Date().toISOString(),
      });
      return 'queued';
    }

    set({ orders: [...prevOrders, optimisticOrder] });

    try {
      await setDoc(doc(db, paths.orders, id), withGeste);

      if (withGeste.status === 'VALIDATED' || withGeste.status === 'PAYE') {
        await useBudgetStore.getState().addBudgetEntry({
          type: 'REVENUE',
          category: 'Vente Directe FBO',
          amount: withGeste.totalMargin || 0,
          date: withGeste.date || localDateISO(),
          description: `Marge sur commande ${withGeste.refCommande} - ${withGeste.customerName}`,
          createdAt: new Date().toISOString(),
          orderId: id,
        });
      }
      return 'saved';
    } catch (err) {
      set({ orders: prevOrders });
      handleFirestoreError(err, OperationType.CREATE, `${paths.orders}/${id}`);
      throw err;
    }
  },

  updateOrder: async (updated) => {
    const { user } = useAuthStore.getState();
    if (!user) {
      throw new Error('Utilisateur non authentifié. Veuillez vous reconnecter.');
    }

    const { isOfflineMode, upsertOrderSyncTask } = useSyncStore.getState();
    const paths = getPaths(user.uid);
    const oldOrd = get().orders.find((o) => o.id === updated.id);

    // Date de validation réelle : posée au passage vers VALIDATED/PAYE (jamais écrasée ensuite)
    let validatedAt = updated.validatedAt;
    if (isCountedStatus(updated.status) && !(oldOrd && isCountedStatus(oldOrd.status))) {
      validatedAt = localDateISO();
    }

    // Recalculer délai livraison si dateReelle changée
    let delaiLivraison = updated.delaiLivraison;
    if (updated.livraison?.dateReelle && updated.date) {
      const d1 = new Date(updated.date);
      const d2 = new Date(updated.livraison.dateReelle);
      delaiLivraison = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Recalculer frais livraison si mode changé
    let livraison = updated.livraison;
    if (oldOrd && oldOrd.livraison?.mode !== updated.livraison?.mode && updated.livraison?.mode) {
      livraison = {
        ...updated.livraison,
        frais: calculateLivraisonFrais(updated.totalRetail, updated.livraison.mode),
      };
    }

    const { synced: _synced, ...withoutSynced } = updated as Order & { synced?: boolean };
    const toSave = {
      ...withoutSynced,
      userId: (updated as any).userId || (oldOrd as any)?.userId || user.uid,
      createdAt: (updated as any).createdAt || (oldOrd as any)?.createdAt || new Date().toISOString(),
      livraison,
      delaiLivraison,
      validatedAt,
    };

    if (isOfflineMode) {
      set((state) => ({
        orders: state.orders.map((o) =>
          o.id === updated.id ? ({ ...toSave, delaiLivraison, synced: false } as Order) : o
        ),
      }));
      upsertOrderSyncTask({
        id: 'sync_' + Math.random().toString(36).substr(2, 9),
        type: 'ORDER',
        entityId: updated.id,
        name: updated.customerName,
        actionType: 'UPDATE',
        payload: toSave,
        createdAt: new Date().toISOString(),
      });
      return 'queued';
    }

    try {
      await updateDoc(doc(db, paths.orders, updated.id), { ...toSave });

      // Handle budget sync based on status change (preserves historical order totals untouched)
      if (updated.status !== 'VALIDATED' && updated.status !== 'PAYE') {
        const matchingEntries = useBudgetStore.getState().budget.filter((entry) => {
          if (entry.orderId === updated.id) return true;
          if (!entry.orderId && oldOrd) {
            const descLower = (entry.description || '').toLowerCase();
            const custLower = (oldOrd.customerName || '').toLowerCase();
            return (
              entry.category === 'Vente Directe FBO' && custLower && descLower.includes(custLower)
            );
          }
          return false;
        });

        for (const entry of matchingEntries) {
          await useBudgetStore.getState().deleteBudgetEntry(entry.id);
        }
      } else if (updated.status === 'VALIDATED' || updated.status === 'PAYE') {
        const matchingEntries = useBudgetStore.getState().budget.filter((entry) => {
          if (entry.orderId === updated.id) return true;
          if (!entry.orderId && oldOrd) {
            const descLower = (entry.description || '').toLowerCase();
            const custLower = (oldOrd.customerName || '').toLowerCase();
            return (
              entry.category === 'Vente Directe FBO' && custLower && descLower.includes(custLower)
            );
          }
          return false;
        });

        if (matchingEntries.length > 0) {
          for (const entry of matchingEntries) {
            await useBudgetStore.getState().updateBudgetEntry({
              ...entry,
              amount: updated.totalMargin,
              date: validatedAt || updated.date,
              description: `Marge sur commande ${updated.refCommande} - ${updated.customerName}`,
              orderId: updated.id,
            });
          }
        } else {
          await useBudgetStore.getState().addBudgetEntry({
            type: 'REVENUE',
            category: 'Vente Directe FBO',
            amount: updated.totalMargin,
            date: validatedAt || updated.date,
            description: `Marge sur commande ${updated.refCommande} - ${updated.customerName}`,
            createdAt: new Date().toISOString(),
            orderId: updated.id,
          });
        }
      }

      set((state) => ({
        orders: state.orders.map((o) =>
          o.id === updated.id ? ({ ...toSave, delaiLivraison, synced: true } as Order) : o
        ),
      }));
      return 'saved';
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${paths.orders}/${updated.id}`);
      throw err;
    }
  },

  deleteOrder: async (id) => {
    const { user } = useAuthStore.getState();
    if (!user) {
      throw new Error('Utilisateur non authentifié. Veuillez vous reconnecter.');
    }

    const { isOfflineMode, upsertSyncTask } = useSyncStore.getState();
    const path = getPaths(user.uid).orders;
    const prevOrders = get().orders;
    const oldOrd = prevOrders.find((o) => o.id === id);

    set({ orders: prevOrders.filter((o) => o.id !== id) });

    if (isOfflineMode) {
      upsertSyncTask({
        id: 'sync_' + Math.random().toString(36).substr(2, 9),
        type: 'ORDER',
        entityId: id,
        name: oldOrd?.customerName || 'Commande',
        actionType: 'DELETE',
        payload: {},
        createdAt: new Date().toISOString(),
      });
      if (oldOrd) {
        const matchingEntries = useBudgetStore.getState().budget.filter((entry) => {
          if (entry.orderId === id) return true;
          if (!entry.orderId) {
            const descLower = (entry.description || '').toLowerCase();
            const custLower = (oldOrd.customerName || '').toLowerCase();
            return (
              entry.category === 'Vente Directe FBO' && custLower && descLower.includes(custLower)
            );
          }
          return false;
        });
        for (const entry of matchingEntries) {
          await useBudgetStore.getState().deleteBudgetEntry(entry.id);
        }
      }
      return 'queued';
    }

    try {
      await deleteDoc(doc(db, path, id));

      if (oldOrd) {
        const matchingEntries = useBudgetStore.getState().budget.filter((entry) => {
          if (entry.orderId === id) return true;
          if (!entry.orderId) {
            const descLower = (entry.description || '').toLowerCase();
            const custLower = (oldOrd.customerName || '').toLowerCase();
            return (
              entry.category === 'Vente Directe FBO' && custLower && descLower.includes(custLower)
            );
          }
          return false;
        });

        for (const entry of matchingEntries) {
          await useBudgetStore.getState().deleteBudgetEntry(entry.id);
        }
      }

      return 'saved';
    } catch (err) {
      set({ orders: prevOrders });
      handleFirestoreError(err, OperationType.DELETE, `${path}/${id}`);
      throw err;
    }
  },

  setOrders: (orders) => set({ orders }),

  initializeListener: () => {
    const { user } = useAuthStore.getState();
    if (!user) {
      set({ orders: [] });
      return () => {};
    }

    const paths = getPaths(user.uid);
    const unsub = onSnapshot(
      collection(db, paths.orders),
      (snap) => {
        const data = snap.docs.map((d) => ({ ...d.data(), id: d.id } as Order));
        set({ orders: data });
      },
      (err) => handleFirestoreError(err, OperationType.LIST, paths.orders)
    );

    return () => unsub();
  },
}));