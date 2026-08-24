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
