// Main store entry point - composes all slices
// This file re-exports all slice hooks for easy importing

export { useAuthStore } from './slices/authSlice';
export { useCustomersStore } from './slices/customersSlice';
export { useOrdersStore } from './slices/ordersSlice';
export { useBudgetStore } from './slices/budgetSlice';
export { useProductsStore } from './slices/productsSlice';
export { useAgendaStore } from './slices/agendaSlice';
export { useDailyLogsStore } from './slices/dailyLogsSlice';
export { useSyncStore, type SyncTask } from './slices/syncSlice';
export { useThemeStore } from './slices/themeSlice';
export { useBackupStore } from './slices/backupSlice';

// Legacy hook for backward compatibility during migration
// TODO: Remove after full migration
import { useAuthStore } from './slices/authSlice';
import { useCustomersStore } from './slices/customersSlice';
import { useOrdersStore } from './slices/ordersSlice';
import { useBudgetStore } from './slices/budgetSlice';
import { useProductsStore } from './slices/productsSlice';
import { useAgendaStore } from './slices/agendaSlice';
import { useDailyLogsStore } from './slices/dailyLogsSlice';
import { useSyncStore } from './slices/syncSlice';
import { useThemeStore } from './slices/themeSlice';
import { useBackupStore } from './slices/backupSlice';

export const useStore = () => ({
  // Auth
  ...useAuthStore(),
  // Customers
  ...useCustomersStore(),
  // Orders
  ...useOrdersStore(),
  // Budget
  ...useBudgetStore(),
  // Products
  ...useProductsStore(),
  // Agenda
  ...useAgendaStore(),
  // Daily Logs
  ...useDailyLogsStore(),
  // Sync
  ...useSyncStore(),
  // Theme
  ...useThemeStore(),
  // Backup
  ...useBackupStore(),
});