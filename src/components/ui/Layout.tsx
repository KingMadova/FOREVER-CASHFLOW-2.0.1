import React, { useEffect, useState } from 'react';
import './AppShell.css';
import { useLocation, useNavigate } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { PageHeader } from './PageHeader';
import { BrandLogo } from './BrandLogo';
import { useAuthStore } from '../../store/slices/authSlice';
import { useSyncStore } from '../../store/slices/syncSlice';
import { useThemeStore } from '../../store/slices/themeSlice';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Target, 
  Users, 
  ShoppingBag, 
  Receipt,
  TrendingUp, 
  Wallet, 
  Calendar, 
  BookOpen,
  User, 
  Sun, 
  Moon, 
  Monitor,
  Wifi,
  WifiOff,
  RefreshCw,
  ChevronDown,
  Settings
} from 'lucide-react';
import { ThemeMode } from '../../types';
import { OnboardingWizard } from './OnboardingWizard';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { themeMode, setThemeMode, profile } = useAuthStore();
  const { isOfflineMode, isSimulatedOffline, toggleSimulatedOffline, syncQueue, isSyncing, triggerSync } = useSyncStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSyncManagerOpen, setIsSyncManagerOpen] = useState(true);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  // Check first launch
  useEffect(() => {
    try {
      const completed = localStorage.getItem('fcf-onboarding-completed');
      if (!completed) {
        setIsOnboardingOpen(true);
      }
    } catch (e) {
      console.error(e);
    }

    const triggerManualOnboarding = () => {
      setIsOnboardingOpen(true);
    };

    window.addEventListener('open-onboarding-wizard', triggerManualOnboarding);
    return () => {
      window.removeEventListener('open-onboarding-wizard', triggerManualOnboarding);
    };
  }, []);

  // Dark mode trigger with reactive system-preference media query listener
  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const applyTheme = () => {
      const prefersDark = mediaQuery.matches;
      const isDark = themeMode === 'dark' || (themeMode === 'system' && prefersDark);
      root.classList.toggle('dark', isDark);
    };

    applyTheme();

    if (themeMode === 'system') {
      mediaQuery.addEventListener('change', applyTheme);
      return () => {
        mediaQuery.removeEventListener('change', applyTheme);
      };
    }
  }, [themeMode]);

  const desktopNavItems = [
    { path: '/', label: 'Accueil', icon: <LayoutDashboard className="w-5 h-5" />, group: 'primary' },
    { path: '/clients', label: 'Clients', icon: <Users className="w-5 h-5" />, group: 'primary' },
    { path: '/orders', label: 'Commandes', icon: <ShoppingBag className="w-5 h-5" />, group: 'primary' },
    { path: '/sales', label: 'Ventes', icon: <Receipt className="w-5 h-5" />, group: 'primary' },
    { path: '/prospects', label: 'Prospects', icon: <Target className="w-5 h-5" />, group: 'secondary' },
    { path: '/projection', label: 'Projection', icon: <TrendingUp className="w-5 h-5" />, group: 'secondary' },
    { path: '/budget', label: 'Budget & Trésorerie', icon: <Wallet className="w-5 h-5" />, group: 'secondary' },
    { path: '/agenda', label: 'Agenda & Rappels', icon: <Calendar className="w-5 h-5" />, group: 'secondary' },
    { path: '/tracker', label: 'Journal G4', icon: <BookOpen className="w-5 h-5" />, group: 'secondary' }
  ];

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Forever CashFlow';
    if (path.startsWith('/prospects')) return 'Prospects Pipeline';
    if (path.startsWith('/clients')) return 'Fiches Clients';
    if (path.startsWith('/orders')) return 'Commandes';
    if (path.startsWith('/sales')) return 'Ventes';
    if (path.startsWith('/projection')) return 'Salle de la Projection';
    if (path.startsWith('/budget')) return 'Finances & Budget';
    if (path.startsWith('/profile')) return 'Profil FBO';
    if (path.startsWith('/settings')) return 'Paramètres Système';
    if (path.startsWith('/agenda')) return 'Agenda FLP';
    return 'Forever CashFlow';
  };

  const handleCycleTheme = () => {
    let next: ThemeMode = 'system';
    if (themeMode === 'system') next = 'light';
    else if (themeMode === 'light') next = 'dark';
    else next = 'system';
    setThemeMode(next);
  };

  return (
    <div id="fcf-app-shell" className="min-h-screen bg-[var(--fcf-background)] text-[var(--fcf-foreground)] flex transition-colors duration-200">
      
      {/* 1. DESKTOP SIDEBAR (visible only at xl: 1280px+) */}
      <aside id="fcf-sidebar" className="hidden xl:flex flex-col w-[232px] bg-[var(--fcf-surface)] border-r border-[var(--fcf-border)] sticky h-screen top-0 shrink-0 z-30">
        {/* Sidebar Header with Gold Accent */}
        <div className="px-4 py-4 border-b border-[var(--fcf-border)] flex flex-col gap-1">
          <div className="flex flex-col gap-1">
            <BrandLogo />
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-[0.12em] pl-1">CRM des Conquérants</span>
          </div>
        </div>

        {/* User Badge */}
        <div className="mx-3 mt-4 p-3 rounded-lg bg-[var(--fcf-background)] border border-[var(--fcf-border)] flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-[var(--fcf-surface-muted)] text-[var(--fcf-brand-terracotta)] font-extrabold flex items-center justify-center text-sm border border-[var(--fcf-border)] overflow-hidden shrink-0">
            {profile.photoUrl ? (
              <img 
                src={profile.photoUrl} 
                alt={profile.name} 
                referrerPolicy="no-referrer" 
                className="w-full h-full object-cover" 
              />
            ) : (
              profile.initials || 'FBO'
            )}
          </div>
          <div className="overflow-hidden">
            <h4 className="font-semibold text-sm truncate text-slate-900 dark:text-slate-100">{profile.name}</h4>
            <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{profile.title}</p>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto fcf-sidebar-nav">
          {desktopNavItems.map((item, index) => {
            const active = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
            return (
              <React.Fragment key={item.path}>
                {item.group === 'secondary' && index === 4 && <div className="fcf-sidebar-divider"><span>ESPACE DE TRAVAIL</span></div>}
                <button onClick={() => navigate(item.path)} title={item.label} aria-current={active ? 'page' : undefined} className={`fcf-sidebar-link ${active ? 'is-active' : ''}`}>
                  {item.icon}<span>{item.label}</span>
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        {/* Sidebar Footer with Theme toggling */}
        <div className="px-3 py-3 border-t border-[var(--fcf-border)] flex items-center justify-between">
          <span className="text-[10px] text-[var(--fcf-muted)]">Thème : {themeMode === 'system' ? 'Système' : themeMode === 'light' ? 'Clair' : 'Sombre'}</span>
          <button
            onClick={handleCycleTheme}
            className="p-2 rounded-md border border-[var(--fcf-border)] bg-[var(--fcf-surface)] text-[var(--fcf-muted)] hover:bg-[var(--fcf-surface-muted)] transition-all outline-none"
            aria-label="Toggle theme"
          >
            {themeMode === 'light' ? (
              <Sun className="w-4 h-4 text-amber-500" />
            ) : themeMode === 'dark' ? (
              <Moon className="w-4 h-4 text-amber-400" />
            ) : (
              <Monitor className="w-4 h-4 text-slate-500" />
            )}
          </button>
        </div>
      </aside>

      {/* Tablet navigation rail: primary workspaces only */}
      <aside className="hidden md:flex xl:hidden fcf-tablet-rail" aria-label="Navigation principale">
        {desktopNavItems.filter(item => item.group === 'primary').map(item => {
          const active = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
          return <button key={item.path} type="button" onClick={() => navigate(item.path)} title={item.label} aria-label={item.label} aria-current={active ? 'page' : undefined} className={active ? 'is-active' : ''}>{item.icon}</button>;
        })}
      </aside>

      {/* 2. MAIN HUB WORKSPACE */}
      <div id="fcf-workspace" className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        
        {/* On Mobile/Tablet: Render page header with the back button dynamically */}
        <div className="fcf-topbar">
          <PageHeader 
            title={getPageTitle()} 
            showBack={false} 
          />
        </div>

        {/* Content canvas */}
        <main id="fcf-main-content" className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 pb-28 xl:pb-12 transition-all">
          {children}
        </main>

        {/* Mobile/Tablet Tab Bar */}
        <div className="md:hidden">
          <BottomNav />
        </div>
      </div>

      {/* Dynamic Offline / Synchronization Queue Console Widget */}
      <AnimatePresence>
        {(isOfflineMode || syncQueue.length > 0 || isSyncing) && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`fixed z-50 transition-all duration-300 ${
              isSyncManagerOpen 
                ? 'bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 w-auto sm:w-96' 
                : 'bottom-20 right-4 sm:bottom-6 sm:right-6 w-auto'
            }`}
            id="offline_sync_manager_panel"
          >
            {isSyncManagerOpen ? (
              <div className="bg-white/95 dark:bg-[#1a1a1d]/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-2xl rounded-[20px] p-4 space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${
                      isSyncing 
                        ? 'bg-amber-500/10 text-amber-500 animate-spin' 
                        : isOfflineMode 
                          ? 'bg-red-500/10 text-red-500' 
                          : 'bg-emerald-500/10 text-emerald-500'
                    }`}>
                      {isSyncing ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : isOfflineMode ? (
                        <WifiOff className="w-4 h-4" />
                      ) : (
                        <Wifi className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                        Synchronisation Offline
                      </h4>
                      <p className="text-[9px] text-slate-400 font-medium leading-none mt-0.5">
                        {isOfflineMode 
                          ? 'Opérations en local temporaire' 
                          : isSyncing 
                            ? 'Synchronisation avec le cloud...' 
                            : 'Connexion réseau active'}
                      </p>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => setIsSyncManagerOpen(false)}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 dark:text-slate-500 select-none cursor-pointer"
                    title="Minimiser"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>

                {/* Queue status block */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold text-slate-400 dark:text-slate-500 uppercase">File d'attente</span>
                    <span className={`px-2 py-0.5 rounded-full font-extrabold ${
                      syncQueue.length > 0 
                        ? 'bg-amber-500/10 text-amber-500 animate-pulse' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}>
                      {syncQueue.length} change(s)
                    </span>
                  </div>

                  {/* List of changes in queue */}
                  {syncQueue.length > 0 ? (
                    <div className="max-h-28 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/50 border border-slate-150 dark:border-slate-850 rounded-xl bg-slate-50/50 dark:bg-[#151518]/50 pr-1">
                      {syncQueue.map((task) => (
                        <div key={task.id} className="p-2 flex items-center justify-between text-[10.5px]">
                          <div className="flex items-center gap-1.5 overflow-hidden">
                            <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase shrink-0 ${
                              task.type === 'CUSTOMER' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-pink-500/10 text-pink-500'
                            }`}>
                              {task.type === 'CUSTOMER' ? 'Prospect' : 'Vente'}
                            </span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                              {task.name}
                            </span>
                          </div>
                          <span className="text-[9px] font-medium text-slate-400 flex items-center gap-1 shrink-0 ml-1">
                            <RefreshCw className="w-2.5 h-2.5 animate-spin text-slate-400" />
                            File d'attente
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 border border-dashed border-slate-200 dark:border-slate-805 rounded-xl text-center">
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">
                        Aucun changement en attente. Tout est à jour !
                      </p>
                    </div>
                  )}
                </div>

                {/* Offline Simulator Switch */}
                <div className="pt-1.5 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                      Simuler réseau hors-ligne ?
                    </span>
                    <span className="text-[8.5px] text-slate-400 font-medium leading-none">
                      Permet de tester la file d'attente locale
                    </span>
                  </div>
                  <button
                    onClick={toggleSimulatedOffline}
                    className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 cursor-pointer ${
                      isSimulatedOffline ? 'bg-red-500' : 'bg-slate-200 dark:bg-slate-800'
                    }`}
                    title="Activer/Désactiver la simulation hors-ligne"
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${
                      isSimulatedOffline ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                {/* Sync Action card hint or force buttons */}
                {syncQueue.length > 0 && (
                  <div className="pt-0.5 select-none">
                    {isOfflineMode ? (
                      <div className="p-2 rounded-xl bg-amber-500/5 border border-amber-500/10 text-[9px] text-amber-600 dark:text-amber-400 font-medium leading-normal flex items-start gap-1.5">
                        <span className="block text-amber-500 mt-0.5">⚠️</span>
                        <span>
                          Rétablissez le réseau (ou décochez la simulation) pour synchroniser la file d'attente.
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={triggerSync}
                        disabled={isSyncing}
                        className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-slate-950 text-xs font-black uppercase rounded-xl shadow-lg shadow-emerald-500/10 cursor-pointer flex items-center justify-center gap-1.5 transition-all active:scale-[98]"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? 'Synchronisation forcée...' : 'Synchroniser maintenant'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Tiny expanded circle sync trigger */
              <button
                onClick={() => setIsSyncManagerOpen(true)}
                className={`p-3 bg-white dark:bg-[#1a1a1d] border border-slate-205 dark:border-slate-800 shadow-2xl rounded-full flex items-center justify-center gap-1.5 hover:scale-105 active:scale-95 transition-all text-slate-750 dark:text-slate-300 w-12 h-12 relative cursor-pointer`}
                title={`${syncQueue.length} changement(s) en attente. Cliquez pour voir.`}
              >
                {isSyncing ? (
                  <RefreshCw className="w-5 h-5 animate-spin text-amber-500" />
                ) : isOfflineMode ? (
                  <WifiOff className="w-5 h-5 text-red-500" />
                ) : (
                  <Wifi className="w-5 h-5 text-emerald-500" />
                )}
                {syncQueue.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 font-black text-[9px] min-w-5 h-5 rounded-full flex items-center justify-center border border-white dark:border-[#1a1a1d] px-1 animate-pulse shadow-sm">
                    {syncQueue.length}
                  </span>
                )}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Onboarding / Quick Start Wizard overlay */}
      <AnimatePresence>
        {isOnboardingOpen && (
          <OnboardingWizard 
            isOpen={isOnboardingOpen} 
            onClose={() => setIsOnboardingOpen(false)} 
            isManualTrigger={localStorage.getItem('fcf-onboarding-completed') === 'true'}
          />
        )}
      </AnimatePresence>

    </div>
  );
};