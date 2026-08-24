import { create } from 'zustand';
import { Order, OrderStatut, OrderItem, OrderType, OrderCanal, OrderPaiement, OrderGeste, Livraison, LivraisonMode } from '../../types';
import { useAuthStore } from './authSlice';
import { useSyncStore } from './syncSlice';
import { db } from '../../lib/firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { getPaths, handleFirestoreError, OperationType } from '../../lib/firestoreService';
import { useBudgetStore } from './budgetSlice';

const PV_PER_CC = 135; // 1 CC = 135 PV (ratio FLP standard)

const DEFAULT_LIVRAISON: Livraison = {
  mode: 'DOMICILE',
  frais: 0,
  datePrevue: new Date().toISOString().split('T')[0],
};

function generateRefCommande(existingOrders: Order[]): string {
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const sequence = (existingOrders.filter(o => o.refCommande.startsWith(`CMD-${today}`)).length + 1).toString().padStart(3, '0');
  return `CMD-${today}-${sequence}`;
}

function calculateLivraisonFrais(totalRetail: number, mode: LivraisonMode): number {
  if (totalRetail >= 15000) return 0; // Livraison offerte ≥ 15k
  switch (mode) {
    case 'DOMICILE': return 5000;
    case 'POINT_RELAIS': return 3000;
    case 'MAIN_PROPRE': return 0;
    case 'RETRAIT_BOUTIQUE': return 0;
    default: return 0;
  }
}

function applyGeste(order: Partial<Order>, currentGrade: { tauxRemise: number }): Partial<Order> {
  const updated = { ...order };
  switch (updated.geste) {
    case 'CLEAN9_-7K':
      updated.gesteMontant = 7166;
      updated.livraison = { ...updated.livraison, frais: 0 };
      break;
    case 'LIVRAISON_GRATUITE':
      updated.livraison = { ...updated.livraison, frais: 0 };
      break;
    case 'FIELDS_OFFERT':
      // Le produit Fields of Greens est ajouté dans items avec prix 0
      updated.gesteMontant = 10285; // Prix retail Fields of Greens
      break;
    case 'REMISE_5':
      updated.discountPercent = 5;
      break;
  }
  return updated;
}

interface OrdersState {
  orders: Order[];
  // Actions
  addOrder: (order: Omit<Order, 'id'>) => Promise<void>;
  updateOrder: (order: Order) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  setOrders: (orders: Order[]) => void;
  initializeListener: () => () => void;
}

export const useOrdersStore = create<OrdersState>((set, get) => ({
  orders: [],

  addOrder: async (ord) => {
    const { user } = useAuthStore.getState();
    if (!user) return;

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

    // Appliquer geste
    const { profile } = useAuthStore.getState();
    const currentGrade = { tauxRemise: 0.38 }; // Will be fetched from profile
    const withGeste = applyGeste(newOrd, currentGrade);

    // Optimistic update
    set((state) => ({
      orders: [...state.orders, { ...withGeste, id, synced: !isOfflineMode } as Order],
    }));

    try {
      await setDoc(doc(db, paths.orders, id), withGeste);

      // Auto-create budget entry if validated
      if (withGeste.status === 'VALIDATED' || withGeste.status === 'PAYE') {
        await useBudgetStore.getState().addBudgetEntry({
          type: 'REVENUE',
          category: 'Vente Directe FBO',
          amount: withGeste.totalMargin,
          date: withGeste.date,
          description: `Marge sur commande ${withGeste.refCommande} - ${withGeste.customerName}`,
          createdAt: new Date().toISOString(),
          orderId: id,
        });
      }
    } catch (err) {
      // Offline: queue for sync
      addToSyncQueue({
        id: 'sync_' + Math.random().toString(36).substr(2, 9),
        type: 'ORDER',
        entityId: id,
        name: ord.customerName,
        actionType: 'ADD',
        payload: withGeste,
        createdAt: new Date().toISOString(),
      });
    }
  },

  updateOrder: async (updated) => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    const paths = getPaths(user.uid);
    try {
      const oldOrd = get().orders.find((o) => o.id === updated.id);
      
      // Recalculer délai livraison si dateReelle changée
      let delaiLivraison = updated.delaiLivraison;
      if (updated.livraison.dateReelle && updated.date) {
        const d1 = new Date(updated.date);
        const d2 = new Date(updated.livraison.dateReelle);
        delaiLivraison = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
      }

      // Recalculer frais livraison si mode changé
      let livraison = updated.livraison;
      if (oldOrd && oldOrd.livraison.mode !== updated.livraison.mode) {
        livraison = { ...updated.livraison, frais: calculateLivraisonFrais(updated.totalRetail, updated.livraison.mode) };
      }

      const toSave = {
        ...updated,
        livraison,
        delaiLivraison,
      };

      await updateDoc(doc(db, paths.orders, updated.id), { ...toSave });

      // Handle budget sync based on status change
      if (updated.status !== 'VALIDATED' && updated.status !== 'PAYE') {
        const matchingEntries = useBudgetStore.getState().budget.filter((entry) => {
          if (entry.orderId === updated.id) return true;
          if (!entry.orderId && oldOrd) {
            const descLower = (entry.description || '').toLowerCase();
            const custLower = (oldOrd.customerName || '').toLowerCase();
            return entry.category === 'Vente Directe FBO' && custLower && descLower.includes(custLower);
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
            return entry.category === 'Vente Directe FBO' && custLower && descLower.includes(custLower);
          }
          return false;
        });

        if (matchingEntries.length > 0) {
          for (const entry of matchingEntries) {
            await useBudgetStore.getState().updateBudgetEntry({
              ...entry,
              amount: updated.totalMargin,
              date: updated.date,
              description: `Marge sur commande ${updated.refCommande} - ${updated.customerName}`,
              orderId: updated.id,
            });
          }
        } else {
          await useBudgetStore.getState().addBudgetEntry({
            type: 'REVENUE',
            category: 'Vente Directe FBO',
            amount: updated.totalMargin,
            date: updated.date,
            description: `Marge sur commande ${updated.refCommande} - ${updated.customerName}`,
            createdAt: new Date().toISOString(),
            orderId: updated.id,
          });
        }
      }
      
      // Update local state
      set((state) => ({
        orders: state.orders.map(o => o.id === updated.id ? { ...toSave, delaiLivraison } : o),
      }));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${paths.orders}/${updated.id}`);
    }
  },

  deleteOrder: async (id) => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    const path = getPaths(user.uid).orders;
    try {
      const oldOrd = get().orders.find((o) => o.id === id);
      await deleteDoc(doc(db, path, id));

      if (oldOrd) {
        const matchingEntries = useBudgetStore.getState().budget.filter((entry) => {
          if (entry.orderId === id) return true;
          if (!entry.orderId) {
            const descLower = (entry.description || '').toLowerCase();
            const custLower = (oldOrd.customerName || '').toLowerCase();
            return entry.category === 'Vente Directe FBO' && custLower && descLower.includes(custLower);
          }
          return false;
        });

        for (const entry of matchingEntries) {
          await useBudgetStore.getState().deleteBudgetEntry(entry.id);
        }
      }
      
      set((state) => ({
        orders: state.orders.filter(o => o.id !== id),
      }));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${path}/${id}`);
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
      query(collection(db, paths.orders), orderBy('date', 'desc')),
      (snap) => {
        const data = snap.docs.map((d) => ({ ...d.data(), id: d.id } as Order));
        set({ orders: data });
      },
      (err) => handleFirestoreError(err, OperationType.LIST, paths.orders)
    );

    return () => unsub();
  },
}));

// Helper pour créer commande avec calculs auto
export function createOrderFromCart(params: {
  customerId: string;
  customerName: string;
  items: OrderItem[];
  type: OrderType;
  canal: OrderCanal;
  paiement: OrderPaiement;
  geste: OrderGeste;
  livraisonMode: LivraisonMode;
  datePrevueLivraison: string;
  distributeurId?: string;
  tags?: string[];
  notes?: string;
  profileGrade: { tauxRemise: number };
}): Omit<Order, 'id'> {
  const totalRetail = params.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const totalCC = params.items.reduce((sum, i) => sum + i.unitCC * i.quantity, 0);
  const totalPV = Math.round(totalCC * PV_PER_CC);
  const totalBV = totalCC; // 1 CC = 1 BV
  const totalCost = params.items.reduce((sum, i) => sum + (i.unitPrice * (1 - params.profileGrade.tauxRemise)) * i.quantity, 0);
  const totalMargin = totalRetail - totalCost;
  
  const livraisonFrais = calculateLivraisonFrais(totalRetail, params.livraisonMode);
  
  const baseOrder: Omit<Order, 'id'> = {
    customerId: params.customerId,
    customerName: params.customerName,
    date: new Date().toISOString().split('T')[0],
    items: params.items,
    status: 'PENDING',
    totalRetail,
    totalCost,
    totalMargin,
    totalCC,
    totalPV,
    totalBV,
    discountPercent: params.geste === 'REMISE_5' ? 5 : undefined,
    type: params.type,
    canal: params.canal,
    paiement: params.paiement,
    geste: params.geste,
    refPaiement: undefined,
    encaissementDate: undefined,
    refCommande: '', // Sera généré dans addOrder
    gesteMontant: undefined,
    livraison: {
      mode: params.livraisonMode,
      frais: livraisonFrais,
      datePrevue: params.datePrevueLivraison,
      dateReelle: undefined,
      transporteur: undefined,
      adresseLivraison: undefined,
    },
    delaiLivraison: undefined,
    satisfaction: undefined,
    satisfactionNote: undefined,
    satisfactionDate: undefined,
    recommandation: false,
    recommandationClientId: undefined,
    distributeurId: params.distributeurId || '',
    tags: params.tags || [],
    notes: params.notes,
  };

  // Appliquer geste
  return applyGeste(baseOrder, params.profileGrade) as Omit<Order, 'id'>;
}