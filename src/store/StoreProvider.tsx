import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useAuthStore } from './slices/authSlice';
import { useCustomersStore } from './slices/customersSlice';
import { useOrdersStore } from './slices/ordersSlice';
import { useBudgetStore } from './slices/budgetSlice';
import { useProductsStore } from './slices/productsSlice';
import { useAgendaStore } from './slices/agendaSlice';
import { useDailyLogsStore } from './slices/dailyLogsSlice';
import { useSyncStore } from './slices/syncSlice';
import { useThemeStore } from './slices/themeSlice';

// Context for the store provider (optional, for components that need the full store)
// We can also just use the hooks directly

interface StoreProviderProps {
  children: ReactNode;
}

export const StoreProvider: React.FC<StoreProviderProps> = ({ children }) => {
  // Initialize all stores
  const initializeAuth = useAuthStore((state) => state.initializeAuth);
  const initializeCustomers = useCustomersStore((state) => state.initializeListener);
  const initializeOrders = useOrdersStore((state) => state.initializeListener);
  const initializeBudget = useBudgetStore((state) => state.initializeListener);
  const initializeProducts = useProductsStore((state) => state.initializeListener);
  const initializeAgenda = useAgendaStore((state) => state.initializeListener);
  const initializeDailyLogs = useDailyLogsStore((state) => state.initializeListener);
  const initializeSync = useSyncStore((state) => state.initializeNetworkListeners);
  const initializeTheme = useThemeStore((state) => state.initializeTheme);

  const [isAuthReady, setIsAuthReady] = React.useState(false);

  useEffect(() => {
    // Initialize theme first (synchronous)
    initializeTheme();

    // Initialize auth and get unsubscribe function
    const unsubscribeAuth = initializeAuth();

    // Initialize network listeners for sync
    const unsubscribeSync = initializeSync();

    // Set up effect to initialize other stores when auth is ready
    const { isAuthenticated, user } = useAuthStore.getState();

    const initOtherStores = () => {
      const unsubCustomers = initializeCustomers();
      const unsubOrders = initializeOrders();
      const unsubBudget = initializeBudget();
      const unsubProducts = initializeProducts();
      const unsubAgenda = initializeAgenda();
      const unsubDailyLogs = initializeDailyLogs();

      return () => {
        unsubCustomers();
        unsubOrders();
        unsubBudget();
        unsubProducts();
        unsubAgenda();
        unsubDailyLogs();
      };
    };

    let unsubscribeOther: (() => void) | undefined;

    // Check auth readiness
    const checkAuthReady = () => {
      const { isAuthReady } = useAuthStore.getState();
      if (isAuthReady) {
        setIsAuthReady(true);
        if (unsubscribeOther) {
          unsubscribeOther();
        }
        unsubscribeOther = initOtherStores();
      }
    };

    // Initial check
    checkAuthReady();

    // Subscribe to auth state changes
    const unsubscribeAuthCheck = useAuthStore.subscribe((state) => {
      if (state.isAuthReady) {
        checkAuthReady();
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeSync();
      unsubscribeAuthCheck();
      if (unsubscribeOther) {
        unsubscribeOther();
      }
    };
  }, [
    initializeAuth,
    initializeCustomers,
    initializeOrders,
    initializeBudget,
    initializeProducts,
    initializeAgenda,
    initializeDailyLogs,
    initializeSync,
    initializeTheme,
  ]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#121215]">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return <>{children}</>;
};

// Optional: Context for components that need access to multiple stores at once
// (rarely needed since we have individual hooks)
interface StoreContextType {
  // This can be expanded if needed for complex components
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const useStoreContext = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStoreContext must be used within a StoreProvider');
  }
  return context;
};