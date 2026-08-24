import { create } from 'zustand';
import { Product } from '../../types';
import { useAuthStore } from './authSlice';
import { db } from '../../lib/firebase';
import { collection, doc, setDoc, deleteDoc, getDocs, query, orderBy, onSnapshot } from 'firebase/firestore';
import { getPaths, handleFirestoreError, OperationType } from '../../lib/firestoreService';

const DEFAULT_PRODUCTS: Product[] = [
  { id: '456', name: 'VITAL 5 - PULPE', prixRetail: 201581, unitCC: 1.0 },
  { id: '634', name: 'START YOUR JOURNEY', prixRetail: 309271, unitCC: 2.0 },
  { id: '15', name: 'FOREVER ALOE VERA GEL', prixRetail: 20156, unitCC: 0.1 },
  { id: '34', name: 'FOREVER ALOE BERRY NECTAR', prixRetail: 20156, unitCC: 0.1 },
  { id: '77', name: "FOREVER BITS N' PEACHES", prixRetail: 20156, unitCC: 0.1 },
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
  { id: '647', name: 'ALOE BODY LOTION', prixRetail: 18338, unitCC: 0.091 },
];

interface ProductsState {
  products: Product[];
  // Actions
  addProduct: (product: Omit<Product, 'createdAt' | 'userId'>) => Promise<void>;
  setProducts: (products: Product[]) => void;
  initializeListener: () => () => void;
  purgePhantomProducts: () => Promise<void>;
  hardResetProducts: () => void;
}

export const useProductsStore = create<ProductsState>((set, get) => ({
  products: DEFAULT_PRODUCTS,

  addProduct: async (product) => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    // Block phantom products from onboarding (id containing _new)
    const rawId = (product as any).id || '';
    if (rawId.includes('_new')) return;

    const path = getPaths(user.uid).products;
    const id = rawId || 'prod_' + Math.random().toString(36).substr(2, 9);
    try {
      await setDoc(doc(db, path, id), {
        ...product,
        id,
        userId: user.uid,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  },

  setProducts: (products) => set({ products }),

  initializeListener: () => {
    const { user } = useAuthStore.getState();
    if (!user) {
      // Load from localStorage or defaults
      try {
        const saved = localStorage.getItem('fcf-products');
        if (saved) {
          const parsed = JSON.parse(saved) as Product[];
          const cleaned = parsed.filter((p) => !p.id.includes('_new'));
          if (cleaned.length < DEFAULT_PRODUCTS.length / 2) {
            localStorage.setItem('fcf-products', JSON.stringify(DEFAULT_PRODUCTS));
            set({ products: DEFAULT_PRODUCTS });
          } else {
            if (cleaned.length !== parsed.length) {
              localStorage.setItem('fcf-products', JSON.stringify(cleaned));
            }
            set({ products: cleaned });
          }
        } else {
          set({ products: DEFAULT_PRODUCTS });
        }
      } catch {
        set({ products: DEFAULT_PRODUCTS });
      }
      return () => {};
    }

    const paths = getPaths(user.uid);
    const unsub = onSnapshot(
      query(collection(db, paths.products), orderBy('name', 'asc')),
      (snap) => {
        if (!snap.empty) {
          const remoteData = snap.docs.map((d) => ({ ...d.data(), id: d.id } as Product));

          // PURGE: delete phantom products (_new) from Firestore
          const phantomProducts = remoteData.filter((p) => p.id.includes('_new'));
          phantomProducts.forEach((phantom) => {
            deleteDoc(doc(db, paths.products, phantom.id)).catch(() => {});
          });

          set((state) => {
            // Start with default products (complete catalog)
            const base = [...DEFAULT_PRODUCTS];

            // Inject only valid remote products (no _new)
            remoteData.forEach((remoteProd) => {
              if (!remoteProd.id.includes('_new')) {
                const index = base.findIndex((p) => p.id === remoteProd.id);
                if (index >= 0) {
                  base[index] = remoteProd;
                } else {
                  base.push(remoteProd);
                }
              }
            });

            return { products: base.filter((p) => !p.id.includes('_new')) };
          });
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, paths.products)
    );

    return () => unsub();
  },

  purgePhantomProducts: async () => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    const path = getPaths(user.uid).products;
    try {
      const snap = await getDocs(collection(db, path));
      if (!snap) return;
      for (const d of snap.docs) {
        await deleteDoc(doc(db, path, d.id)).catch(() => {});
      }
      localStorage.removeItem('fcf-products');
      set({ products: DEFAULT_PRODUCTS });
    } catch (err) {
      console.error('purgePhantomProducts error:', err);
    }
  },

  hardResetProducts: () => {
    localStorage.removeItem('fcf-products');
    set({ products: DEFAULT_PRODUCTS });
  },
}));