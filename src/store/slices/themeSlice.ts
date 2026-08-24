import { create } from 'zustand';
import { ThemeMode } from '../../types';

interface ThemeState {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  initializeTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  themeMode: 'system',

  setThemeMode: (mode) => {
    try {
      localStorage.setItem('fcf-theme', mode);
    } catch (e) {
      console.error(e);
    }
    set({ themeMode: mode });
  },

  initializeTheme: () => {
    try {
      const saved = localStorage.getItem('fcf-theme') as ThemeMode;
      if (saved) {
        set({ themeMode: saved });
      }
    } catch {
      // ignore
    }
  },
}));