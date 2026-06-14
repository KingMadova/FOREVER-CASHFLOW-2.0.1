import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { Customer, Order, BudgetEntry, UserProfile, Product, ThemeMode, GradeCode, AgendaItem } from '../types';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';
import { getPaths, handleFirestoreError, OperationType } from '../lib/firestoreService';

export interface SyncTask {
  id: string;
  type: 'CUSTOMER' | 'ORDER';
  entityId: string;
  name: string;
  actionType: 'ADD';
  payload: any;
  createdAt: string;
}

interface StoreContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  profile: UserProfile;
  updateProfile: (profile: UserProfile) => void;
  customers: Customer[];
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt'>) => void;
  updateCustomer: (customer: Customer) => void;
  deleteCustomer: (id: string) => void;
  orders: Order[];
  addOrder: (order: Omit<Order, 'id'>) => void;
  updateOrder: (order: Order) => void;
  deleteOrder: (id: string) => void;
  budget: BudgetEntry[];
  addBudgetEntry: (entry: Omit<BudgetEntry, 'id'>) => void;
  deleteBudgetEntry: (id: string) => void;
  products: Product[];
  addProduct: (product: Omit<Product, 'createdAt' | 'userId'>) => Promise<void>;
  agendaList: AgendaItem[];
  addAgendaItem: (item: Omit<AgendaItem, 'id' | 'completed'>) => void;
  updateAgendaItem: (item: AgendaItem) => void;
  deleteAgendaItem: (id: string) => void;
  toggleAgendaItemCompleted: (id: string) => void;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
  // Offline Synchronization system
  isOfflineMode: boolean;
  isSimulatedOffline: boolean;
  toggleSimulatedOffline: () => void;
  syncQueue: SyncTask[];
  isSyncing: boolean;
  triggerSync: () => Promise<void>;
  // Backup / Restore Actions
  importBackupData: (data: any) => Promise<void>;
  hardResetData: () => Promise<void>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

// Core default products
const DEFAULT_PRODUCTS: Product[] = [
  { id: '456', name: 'VITAL 5 - PULPE', prixRetail: 201581, unitCC: 1.0 },
  { id: '634', name: 'START YOUR JOURNEY', prixRetail: 309271, unitCC: 2.0 },
  { id: '15', name: 'FOREVER ALOE VERA GEL', prixRetail: 20156, unitCC: 0.1 },
  { id: '34', name: 'FOREVER ALOE BERRY NECTAR', prixRetail: 20156, unitCC: 0.1 },
  { id: '77', name: 'FOREVER BITS N\' PEACHES', prixRetail: 20156, unitCC: 0.1 },
  { id: '196', name: 'FOREVER FREEDOM', prixRetail: 29439, unitCC: 0.146 },
  { id: '200', name: 'ALOE BLOSSOM HERBAL TEA', prixRetail: 14116, unitCC: 0.07 },
  { id: '721', name: 'FAB', prixRetail: 6974, unitCC: 0.019 },
  { id: '26', name: 'FOREVER BEE POLLEN', prixRetail: 12091, unitCC: 0.06 },
  { id: '27', name: 'FOREVER BEE PROPOLIS', prixRetail: 26207, unitCC: 0.13 },
  { id: '36', name: 'FOREVER ROYAL JELLY', prixRetail: 26207, unitCC: 0.13 },
  { id: '207', name: 'FOREVER BEE HONEY', prixRetail: 19970, unitCC: 0.07 },
  { id: '37', name: 'FOREVER NATURE-MIN', prixRetail: 14529, unitCC: 0.072 },
  { id: '48', name: 'FOREVER ABSORBENT-C', prixRetail: 13909, unitCC: 0.069 },
  { id: '65', name: 'FOREVER GARLIC - THYME', prixRetail: 14529, unitCC: 0.072 },
  { id: '68', name: 'FOREVER FIELDS OF GREENS', prixRetail: 10285, unitCC: 0.051 },
  { id: '72', name: 'FOREVER LYCUUM PLUS', prixRetail: 24194, unitCC: 0.12 },
  { id: '188', name: 'FOREVER B-12 PLUS', prixRetail: 12505, unitCC: 0.062 },
  { id: '206', name: 'FOREVER CALCIUM', prixRetail: 19742, unitCC: 0.098 },
  { id: '215', name: 'FOREVER MULTI-MACA', prixRetail: 21571, unitCC: 0.107 },
  { id: '264', name: 'FOREVER ACTIVE HA', prixRetail: 27415, unitCC: 0.136 },
  { id: '312', name: 'FOREVER CARDIO HEALTH', prixRetail: 26806, unitCC: 0.133 },
  { id: '354', name: 'FOREVER KIDS', prixRetail: 12091, unitCC: 0.06 },
  { id: '355', name: 'FOREVER IMMUBLEND', prixRetail: 18741, unitCC: 0.093 },
  { id: '374', name: 'VITOLIZE MEN', prixRetail: 24194, unitCC: 0.12 },
  { id: '375', name: 'VITOLIZE WOMEN', prixRetail: 25608, unitCC: 0.127 },
  { id: '376', name: 'FOREVER ARCTIC SEA', prixRetail: 24194, unitCC: 0.12 },
  { id: '439', name: 'FOREVER DAILY', prixRetail: 16129, unitCC: 0.08 },
  { id: '504', name: 'ARGH-ENHANCED (STICK PACKS)', prixRetail: 61077, unitCC: 0.303 },
  { id: '551', name: 'FOREVER MOVE', prixRetail: 50401, unitCC: 0.25 },
  { id: '610', name: 'FOREVER ACTIVE PRO-B', prixRetail: 29646, unitCC: 0.147 },
  { id: '622', name: 'FOREVER FOCUS', prixRetail: 67335, unitCC: 0.334 },
  { id: '624', name: 'FOREVER IVISION', prixRetail: 28231, unitCC: 0.14 },
  { id: '71', name: 'FOREVER GARCINIA PLUS', prixRetail: 24194, unitCC: 0.12 },
  { id: '470', name: 'FOREVER LITE ULTRA W/A VANILLA', prixRetail: 24607, unitCC: 0.122 },
  { id: '471', name: 'FOREVER LITE ULTRA W/A CHOCOLATE', prixRetail: 24607, unitCC: 0.122 },
  { id: '520', name: 'FOREVER FAST BREAK BAR', prixRetail: 4234, unitCC: 0.021 },
  { id: '547', name: 'C9 - VANILLA', prixRetail: 97166, unitCC: 0.482 },
  { id: '548', name: 'C9 - CHOCOLATE', prixRetail: 97166, unitCC: 0.482 },
  { id: '22', name: 'ALOE LIPS', prixRetail: 4228, unitCC: 0.014 },
  { id: '28', name: 'FOREVER BRIGHT TOOTHGEL', prixRetail: 8928, unitCC: 0.031 },
  { id: '40', name: 'ALOE FIRST SPRAY', prixRetail: 15922, unitCC: 0.079 },
  { id: '67', name: 'ALOE EVER-SHIELD DEODORANT', prixRetail: 8714, unitCC: 0.029 },
  { id: '284', name: 'AVOCADO FACE & BODY SOAP', prixRetail: 5453, unitCC: 0.027 },
  { id: '633', name: 'ALOE LIQUID SOAP', prixRetail: 24885, unitCC: 0.075 },
  { id: '51', name: 'ALOE PROPOLIS CRÈME', prixRetail: 15531, unitCC: 0.077 },
  { id: '61', name: 'ALOE VERA GELLY', prixRetail: 11689, unitCC: 0.058 },
  { id: '63', name: 'ALOE MOISTURIZING LOTION', prixRetail: 11689, unitCC: 0.058 },
  { id: '64', name: 'ALOE HEAT LOTION', prixRetail: 11689, unitCC: 0.058 },
  { id: '205', name: 'ALOE MSM GEL', prixRetail: 18741, unitCC: 0.093 },
  { id: '612', name: 'ALOE ACTIVATOR', prixRetail: 12897, unitCC: 0.064 },
  { id: '646', name: 'ALOE BODY WASH', prixRetail: 18142, unitCC: 0.09 },
  { id: '647', name: 'ALOE BODY LOTION', prixRetail: 18338, unitCC: 0.091 }
];

const DEFAULT_PROFILE: UserProfile = {
  name: '',
  title: '',
  grade: 'A', // Animateur (38%)
  initials: '',
  companyName: '',
  companyAddress: '',
  companyPhone: '',
  companyEmail: '',
  fboId: '',
  waveMoney: '',
  orangeMoney: '',
  bankRIB: '',
  tvaApplicable: false,
  monthlyGoalCC: 0,
  monthlyGoalAmount: 0
};

const DEFAULT_CUSTOMERS: Customer[] = [];

const DEFAULT_ORDERS: Order[] = [];

const DEFAULT_BUDGET: BudgetEntry[] = [];

const DEFAULT_AGENDA: AgendaItem[] = [];

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      return (localStorage.getItem('fcf-theme') as ThemeMode) || 'system';
    } catch {
      return 'system';
    }
  });

  const [profile, setProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem('fcf-profile');
      return saved ? JSON.parse(saved) : DEFAULT_PROFILE;
    } catch {
      return DEFAULT_PROFILE;
    }
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    try {
      const saved = localStorage.getItem('fcf-customers');
      return saved ? JSON.parse(saved) : DEFAULT_CUSTOMERS;
    } catch {
      return DEFAULT_CUSTOMERS;
    }
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem('fcf-orders');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.some((o: any) => o.items.some((it: any) => it.productId === 'p3' || it.productId === 'p1'))) {
          localStorage.setItem('fcf-orders', JSON.stringify(DEFAULT_ORDERS));
          return DEFAULT_ORDERS;
        }
        return parsed;
      }
      return DEFAULT_ORDERS;
    } catch {
      return DEFAULT_ORDERS;
    }
  });

  const [budget, setBudget] = useState<BudgetEntry[]>(() => {
    try {
      const saved = localStorage.getItem('fcf-budget');
      return saved ? JSON.parse(saved) : DEFAULT_BUDGET;
    } catch {
      return DEFAULT_BUDGET;
    }
  });

  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('fcf-products');
      if (saved) {
        const parsed = JSON.parse(saved) as Product[];
        // Si la liste sauvegardée est suspecte (trop courte), on remet les défauts
        if (parsed.length < DEFAULT_PRODUCTS.length / 2) {
          return DEFAULT_PRODUCTS;
        }
        // Nettoyage des produits fantômes au passage
        return parsed.filter(p => !p.id.endsWith('_new'));
      }
      return DEFAULT_PRODUCTS;
    } catch {
      return DEFAULT_PRODUCTS;
    }
  });

  const [agendaList, setAgendaList] = useState<AgendaItem[]>(() => {
    try {
      const saved = localStorage.getItem('fcf-agenda');
      return saved ? JSON.parse(saved) : DEFAULT_AGENDA;
    } catch {
      return DEFAULT_AGENDA;
    }
  });

  // Sync state & connection state
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  const [isSimulatedOffline, setIsSimulatedOffline] = useState<boolean>(() => {
    try {
      return localStorage.getItem('fcf-simulated-offline') === 'true';
    } catch {
      return false;
    }
  });

  const [syncQueue, setSyncQueue] = useState<SyncTask[]>(() => {
    try {
      const saved = localStorage.getItem('fcf-sync-queue');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const isOfflineMode = !isOnline || isSimulatedOffline;

  // Sync state & simulated status persistence
  useEffect(() => {
    try {
      localStorage.setItem('fcf-simulated-offline', isSimulatedOffline ? 'true' : 'false');
    } catch (e) {
      console.error(e);
    }
  }, [isSimulatedOffline]);

  useEffect(() => {
    try {
      localStorage.setItem('fcf-sync-queue', JSON.stringify(syncQueue));
    } catch (e) {
      console.error(e);
    }
  }, [syncQueue]);

  // Listener for real network events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const toggleSimulatedOffline = () => {
    setIsSimulatedOffline(prev => !prev);
  };

  const triggerSync = async () => {
    if (syncQueue.length === 0 || isSyncing || isOfflineMode) return;
    setIsSyncing(true);

    const tasksToProcess = [...syncQueue];

    for (const task of tasksToProcess) {
      // Simulate real-world network delay for a satisfyingly premium UI transition
      await new Promise(resolve => setTimeout(resolve, 800));

      if (task.type === 'CUSTOMER') {
        setCustomers(prev => prev.map(c => c.id === task.entityId ? { ...c, synced: true } : c));
      } else if (task.type === 'ORDER') {
        setOrders(prev => prev.map(o => o.id === task.entityId ? { ...o, synced: true } : o));
      }

      setSyncQueue(prev => prev.filter(t => t.id !== task.id));
    }

    setIsSyncing(false);
  };

  // Sync automatically upon recovery
  useEffect(() => {
    if (!isOfflineMode && syncQueue.length > 0 && !isSyncing) {
      triggerSync();
    }
  }, [isOfflineMode, syncQueue.length, isSyncing]);

  // Actions
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setIsAuthenticated(!!firebaseUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Sync other states to local storage and Firestore
  useEffect(() => {
    try {
      localStorage.setItem('fcf-theme', themeMode);
      if (user) {
        const path = getPaths(user.uid).user;
        setDoc(doc(db, path), { themeMode }, { merge: true })
          .catch(err => handleFirestoreError(err, OperationType.UPDATE, path));
      }
    } catch (e) {
      console.error(e);
    }
  }, [themeMode, user]);

  // Firestore Data Listeners
  useEffect(() => {
    if (!user) {
      setCustomers(DEFAULT_CUSTOMERS);
      setOrders(DEFAULT_ORDERS);
      setBudget(DEFAULT_BUDGET);
      setAgendaList(DEFAULT_AGENDA);
      return;
    }

    const paths = getPaths(user.uid);

    // Profile listener
    const unsubProfile = onSnapshot(doc(db, paths.user), (docSnap) => {
      if (docSnap.exists()) {
        const profileData = docSnap.data() as UserProfile;
        setProfile(profileData);
        if (profileData.themeMode) {
          setThemeMode(profileData.themeMode as ThemeMode);
        }
      } else {
        const initials = user.displayName
          ? user.displayName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
          : 'FBO';
        const bootstrappedProfile: UserProfile = {
          name: user.displayName || '',
          title: 'Distributeur Indépendant',
          grade: 'A',
          initials,
          photoUrl: user.photoURL || '',
          companyEmail: user.email || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          themeMode: themeMode
        };
        setDoc(doc(db, paths.user), bootstrappedProfile, { merge: true })
          .catch(err => handleFirestoreError(err, OperationType.CREATE, paths.user));
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, paths.user));

    // Customers listener
    const unsubCustomers = onSnapshot(query(collection(db, paths.customers), orderBy('createdAt', 'desc')), (snap) => {
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as Customer));
      setCustomers(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, paths.customers));

    // Orders listener
    const unsubOrders = onSnapshot(query(collection(db, paths.orders), orderBy('date', 'desc')), (snap) => {
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as Order));
      setOrders(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, paths.orders));

    // Budget listener
    const unsubBudget = onSnapshot(query(collection(db, paths.budget), orderBy('date', 'desc')), (snap) => {
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as BudgetEntry));
      setBudget(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, paths.budget));

    // Agenda listener
    const unsubAgenda = onSnapshot(query(collection(db, paths.agenda), orderBy('date', 'desc')), (snap) => {
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as AgendaItem));
      setAgendaList(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, paths.agenda));

    // Products listener
    const unsubProducts = onSnapshot(query(collection(db, paths.products), orderBy('name', 'asc')), (snap) => {
      if (!snap.empty) {
        const remoteData = snap.docs.map(d => ({ ...d.data(), id: d.id } as Product));
        
        setProducts(prev => {
          // On commence avec les produits par défaut (le catalogue complet)
          const base = [...DEFAULT_PRODUCTS];
          
          // On injecte les produits distants (soit des mises à jour, soit des nouveaux)
          remoteData.forEach(remoteProd => {
            if (!remoteProd.id.includes('_new')) {
              const index = base.findIndex(p => p.id === remoteProd.id);
              if (index >= 0) {
                base[index] = remoteProd;
              } else {
                base.push(remoteProd);
              }
            }
          });
          
          return base.filter(p => !p.id.includes('_new'));
        });
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, paths.products));

    return () => {
      unsubProfile();
      unsubCustomers();
      unsubOrders();
      unsubBudget();
      unsubAgenda();
      unsubProducts();
    };
  }, [user]);

  // Actions
  const updateProfile = async (newProfile: UserProfile) => {
    if (!user) return;
    const path = getPaths(user.uid).user;
    try {
      await setDoc(doc(db, path), {
        ...newProfile,
        name: newProfile.name || profile.name || '',
        grade: newProfile.grade || profile.grade || 'A',
        createdAt: newProfile.createdAt || profile.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        themeMode: themeMode
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const addCustomer = async (cust: Omit<Customer, 'id' | 'createdAt'>) => {
    if (!user) return;
    const path = getPaths(user.uid).customers;
    const id = 'cust_' + Math.random().toString(36).substr(2, 9);
    const newCust = {
      ...cust,
      userId: user.uid,
      createdAt: new Date().toISOString().split('T')[0],
    };
    try {
      await setDoc(doc(db, path, id), newCust);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const updateCustomer = async (updated: Customer) => {
    if (!user) return;
    const path = getPaths(user.uid).customers;
    try {
      await updateDoc(doc(db, path, updated.id), { ...updated });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${path}/${updated.id}`);
    }
  };

  const deleteCustomer = async (id: string) => {
    if (!user) return;
    const path = getPaths(user.uid).customers;
    try {
      await deleteDoc(doc(db, path, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${path}/${id}`);
    }
  };

  const addOrder = async (ord: Omit<Order, 'id'>) => {
    if (!user) return;
    const paths = getPaths(user.uid);
    const id = 'ord_' + Math.random().toString(36).substr(2, 9);
    const newOrd = {
      ...ord,
      userId: user.uid,
      createdAt: new Date().toISOString()
    };
    try {
      await setDoc(doc(db, paths.orders, id), newOrd);
      
      if (newOrd.status === 'VALIDATED') {
        await addBudgetEntry({
          type: 'REVENUE',
          category: 'Vente Directe FBO',
          amount: newOrd.totalMargin,
          date: newOrd.date,
          description: `Marge sur commande de ${newOrd.customerName}`,
          createdAt: new Date().toISOString(),
          orderId: id
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, paths.orders);
    }
  };

  const updateBudgetEntry = async (updated: BudgetEntry) => {
    if (!user) return;
    const path = getPaths(user.uid).budget;
    try {
      await updateDoc(doc(db, path, updated.id), { ...updated });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${path}/${updated.id}`);
    }
  };

  const updateOrder = async (updated: Order) => {
    if (!user) return;
    const paths = getPaths(user.uid);
    try {
      const oldOrd = orders.find(o => o.id === updated.id);
      await updateDoc(doc(db, paths.orders, updated.id), { ...updated });

      // If the updated status is NOT validated (such as PENDING or CANCELLED)
      if (updated.status !== 'VALIDATED') {
        const matchingEntries = budget.filter(entry => {
          if (entry.orderId === updated.id) return true;
          if (!entry.orderId && oldOrd) {
            const descLower = (entry.description || '').toLowerCase();
            const custLower = (oldOrd.customerName || '').toLowerCase();
            return entry.category === 'Vente Directe FBO' &&
                   custLower &&
                   descLower.includes(custLower);
          }
          return false;
        });

        for (const entry of matchingEntries) {
          await deleteBudgetEntry(entry.id);
        }
      } 
      // If the updated status is VALIDATED, make sure we have exactly one matching budget entry with correct parameters
      else if (updated.status === 'VALIDATED') {
        const matchingEntries = budget.filter(entry => {
          if (entry.orderId === updated.id) return true;
          if (!entry.orderId && oldOrd) {
            const descLower = (entry.description || '').toLowerCase();
            const custLower = (oldOrd.customerName || '').toLowerCase();
            return entry.category === 'Vente Directe FBO' &&
                   custLower &&
                   descLower.includes(custLower);
          }
          return false;
        });

        if (matchingEntries.length > 0) {
          for (const entry of matchingEntries) {
            // Update to keep details perfectly in sync & attach orderId
            await updateBudgetEntry({
              ...entry,
              amount: updated.totalMargin,
              date: updated.date,
              description: `Marge sur commande de ${updated.customerName}`,
              orderId: updated.id
            });
          }
        } else {
          // If none exists, add a new one
          await addBudgetEntry({
            type: 'REVENUE',
            category: 'Vente Directe FBO',
            amount: updated.totalMargin,
            date: updated.date,
            description: `Marge sur commande de ${updated.customerName}`,
            createdAt: new Date().toISOString(),
            orderId: updated.id
          });
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${paths.orders}/${updated.id}`);
    }
  };

  const deleteOrder = async (id: string) => {
    if (!user) return;
    const path = getPaths(user.uid).orders;
    try {
      const oldOrd = orders.find(o => o.id === id);
      await deleteDoc(doc(db, path, id));

      if (oldOrd) {
        const matchingEntries = budget.filter(entry => {
          if (entry.orderId === id) return true;
          if (!entry.orderId) {
            const descLower = (entry.description || '').toLowerCase();
            const custLower = (oldOrd.customerName || '').toLowerCase();
            return entry.category === 'Vente Directe FBO' &&
                   custLower &&
                   descLower.includes(custLower);
          }
          return false;
        });

        for (const entry of matchingEntries) {
          await deleteBudgetEntry(entry.id);
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${path}/${id}`);
    }
  };

  const addBudgetEntry = async (entry: Omit<BudgetEntry, 'id'>) => {
    if (!user) return;
    const path = getPaths(user.uid).budget;
    const id = 'bud_' + Math.random().toString(36).substr(2, 9);
    try {
      await setDoc(doc(db, path, id), {
        ...entry,
        userId: user.uid,
        createdAt: entry.createdAt || new Date().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const deleteBudgetEntry = async (id: string) => {
    if (!user) return;
    const path = getPaths(user.uid).budget;
    try {
      await deleteDoc(doc(db, path, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${path}/${id}`);
    }
  };

  const addProduct = async (product: Omit<Product, 'createdAt' | 'userId'>) => {
    if (!user) return;
    const path = getPaths(user.uid).products;
    const id = (product as any).id || 'prod_' + Math.random().toString(36).substr(2, 9);
    try {
      await setDoc(doc(db, path, id), {
        ...product,
        id: id,
        userId: user.uid,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const addAgendaItem = async (item: Omit<AgendaItem, 'id' | 'completed'>) => {
    if (!user) return;
    const path = getPaths(user.uid).agenda;
    const id = 'ag_' + Math.random().toString(36).substr(2, 9);
    try {
      await setDoc(doc(db, path, id), {
        ...item,
        userId: user.uid,
        completed: false,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const updateAgendaItem = async (updated: AgendaItem) => {
    if (!user) return;
    const path = getPaths(user.uid).agenda;
    try {
      await updateDoc(doc(db, path, updated.id), { ...updated });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${path}/${updated.id}`);
    }
  };

  const deleteAgendaItem = async (id: string) => {
    if (!user) return;
    const path = getPaths(user.uid).agenda;
    try {
      await deleteDoc(doc(db, path, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${path}/${id}`);
    }
  };

  const toggleAgendaItemCompleted = async (id: string) => {
    if (!user) return;
    const path = getPaths(user.uid).agenda;
    const item = agendaList.find(a => a.id === id);
    if (!item) return;
    try {
      await updateDoc(doc(db, path, id), { completed: !item.completed });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${path}/${id}`);
    }
  };

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Programmatically exclude entries linked to non-validated (e.g. CANCELLED, PENDING) or deleted orders
  const filteredBudget = useMemo(() => {
    return budget.filter(entry => {
      if (entry.category === 'Vente Directe FBO') {
        if (entry.orderId) {
          const correspondingOrder = orders.find(o => o.id === entry.orderId);
          // If the order was deleted (correspondingOrder is undefined) or its status is not VALIDATED, exclude it
          if (!correspondingOrder || correspondingOrder.status !== 'VALIDATED') {
            return false; // Exclude
          }
        } else {
          // If the entry has no orderId, it might be a legacy entry linked to a cancelled or pending order.
          // We only exclude it if we find an existing corresponding non-validated order in the database.
          // For manually added entries or orphans without corresponding non-validated orders, we keep them!
          const descLower = (entry.description || '').toLowerCase();
          const matchesNonValidatedOrder = orders.some(o => {
            if (o.status === 'VALIDATED') return false;
            const custLower = (o.customerName || '').toLowerCase();
            if (!custLower) return false;
            return descLower.includes(custLower) && 
                   (entry.date === o.date || Math.abs(entry.amount - o.totalMargin) < 1);
          });
          if (matchesNonValidatedOrder) {
            return false; // Exclude
          }
        }
      }
      return true;
    });
  }, [budget, orders]);

  const login = () => {
    // Rely on onAuthStateChanged to flip the bit
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setIsAuthenticated(false);
    } catch (e) {
      console.error(e);
    }
  };

  const importBackupData = async (data: any) => {
    if (!data) return;

    if (user) {
      const paths = getPaths(user.uid);
      
      // Import Profile
      if (data.profile) {
        await setDoc(doc(db, paths.user), {
          ...data.profile,
          themeMode: data.profile.themeMode || themeMode
        }, { merge: true }).catch(err => {
          console.error("Error importing profile:", err);
        });
      }
      
      // Import Customers
      if (data.customers && Array.isArray(data.customers)) {
        for (const cust of data.customers) {
          const custId = cust.id || 'cust_' + Math.random().toString(36).substr(2, 9);
          const cleanCust = { ...cust };
          delete cleanCust.id;
          await setDoc(doc(db, paths.customers, custId), {
            ...cleanCust,
            userId: user.uid,
            createdAt: cust.createdAt || new Date().toISOString()
          }).catch(err => console.error("Error importing customer:", err));
        }
      }
      
      // Import Orders
      if (data.orders && Array.isArray(data.orders)) {
        for (const ord of data.orders) {
          const ordId = ord.id || 'ord_' + Math.random().toString(36).substr(2, 9);
          const cleanOrd = { ...ord };
          delete cleanOrd.id;
          await setDoc(doc(db, paths.orders, ordId), {
            ...cleanOrd,
            userId: user.uid,
            createdAt: ord.createdAt || new Date().toISOString()
          }).catch(err => console.error("Error importing order:", err));
        }
      }
      
      // Import Budget
      if (data.budget && Array.isArray(data.budget)) {
        for (const entry of data.budget) {
          const entryId = entry.id || 'bud_' + Math.random().toString(36).substr(2, 9);
          const cleanEntry = { ...entry };
          delete cleanEntry.id;
          await setDoc(doc(db, paths.budget, entryId), {
            ...cleanEntry,
            userId: user.uid,
            createdAt: entry.createdAt || new Date().toISOString()
          }).catch(err => console.error("Error importing budget entry:", err));
        }
      }
    } else {
      // Offline mode backup
      if (data.customers) localStorage.setItem('fcf-customers', JSON.stringify(data.customers));
      if (data.orders) localStorage.setItem('fcf-orders', JSON.stringify(data.orders));
      if (data.budget) localStorage.setItem('fcf-budget', JSON.stringify(data.budget));
      if (data.profile) localStorage.setItem('fcf-profile', JSON.stringify(data.profile));
    }
  };

  const hardResetData = async () => {
    // 1. Clear local storage
    localStorage.removeItem('fcf-customers');
    localStorage.removeItem('fcf-orders');
    localStorage.removeItem('fcf-budget');
    localStorage.removeItem('fcf-simulated-offline');
    localStorage.removeItem('fcf-sync-queue');
    localStorage.removeItem('fcf-theme');
    localStorage.removeItem('fcf-profile');
    localStorage.removeItem('fcf-agenda');
    localStorage.removeItem('fcf-products');

    // 2. Clear Firestore lists for that user
    if (user) {
      const paths = getPaths(user.uid);
      await deleteDoc(doc(db, paths.user)).catch(() => {});
      
      for (const cust of customers) {
        await deleteDoc(doc(db, paths.customers, cust.id)).catch(() => {});
      }
      for (const ord of orders) {
        await deleteDoc(doc(db, paths.orders, ord.id)).catch(() => {});
      }
      for (const entry of budget) {
        await deleteDoc(doc(db, paths.budget, entry.id)).catch(() => {});
      }
      for (const item of agendaList) {
        await deleteDoc(doc(db, paths.agenda, item.id)).catch(() => {});
      }
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#121215]">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <StoreContext.Provider
      value={{
        themeMode,
        setThemeMode,
        profile,
        updateProfile,
        customers,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        orders,
        addOrder,
        updateOrder,
        deleteOrder,
        budget: filteredBudget,
        addBudgetEntry,
        deleteBudgetEntry,
        products,
        addProduct,
        agendaList,
        addAgendaItem,
        updateAgendaItem,
        deleteAgendaItem,
        toggleAgendaItemCompleted,
        isAuthenticated,
        login,
        logout,
        isOfflineMode,
        isSimulatedOffline,
        toggleSimulatedOffline,
        syncQueue,
        isSyncing,
        triggerSync,
        importBackupData,
        hardResetData
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
