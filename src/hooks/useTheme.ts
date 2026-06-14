import { useState, useEffect } from 'react';
import { ThemeMode } from '../types';

export const useTheme = () => {
  const [mode, setMode] = useState<ThemeMode>(() => {
    try {
      return (localStorage.getItem('fcf-theme') as ThemeMode) || 'system';
    } catch {
      return 'system';
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = mode === 'dark' || (mode === 'system' && prefersDark);
    
    // Toggle class dark
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    try {
      localStorage.setItem('fcf-theme', mode);
    } catch (e) {
      console.error('LocalStorage not available for theme saving', e);
    }
  }, [mode]);

  return { mode, setMode };
};
