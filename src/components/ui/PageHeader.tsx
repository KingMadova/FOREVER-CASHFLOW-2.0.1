import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Sun, 
  Moon, 
  Monitor, 
  Wallet, 
  User, 
  Calendar, 
  ArrowLeft, 
  Settings, 
  Wifi, 
  WifiOff, 
  RefreshCw,
  ChevronDown,
  LayoutDashboard
} from 'lucide-react';
import { ThemeMode, GRADES } from '../../types';
import { useStore } from '../../store/useStore';
import { NotificationCenter } from './NotificationCenter';

interface PageHeaderProps {
  title: string;
  showBack?: boolean;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, showBack = false }) => {
  const { 
    themeMode, 
    setThemeMode, 
    profile,
    isOfflineMode,
    isSimulatedOffline,
    toggleSimulatedOffline,
    syncQueue,
    isSyncing,
    triggerSync
  } = useStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    if (isProfileOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isProfileOpen]);

  // Cycle theme mode from dropdown or buttons
  const handleSetTheme = (mode: ThemeMode) => {
    setThemeMode(mode);
  };

  const getThemeIcon = (mode: ThemeMode) => {
    switch (mode) {
      case 'light': return <Sun className="w-3.5 h-3.5" />;
      case 'dark': return <Moon className="w-3.5 h-3.5" />;
      default: return <Monitor className="w-3.5 h-3.5" />;
    }
  };

  const getThemeLabel = (mode: ThemeMode) => {
    switch (mode) {
      case 'light': return 'Clair';
      case 'dark': return 'Sombre';
      default: return 'Système';
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white/80 dark:bg-[#09090b]/80 backdrop-blur border-b border-slate-100 dark:border-slate-800 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        
        {/* Left: Back button or brand title */}
        <div className="flex items-center gap-2">
          {showBack ? (
            <button
              onClick={() => navigate(-1)}
              className="p-3 -ml-3 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 active:scale-95 transition-all outline-none min-w-[48px] min-h-[48px] flex items-center justify-center"
              aria-label="Retour"
              id="header_back_btn"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          ) : null}
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight leading-none font-display">
            {title}
          </h1>
        </div>

        {/* Right side controls: Streamlined and simplified */}
        <div className="flex items-center gap-2">
          
          {/* Network status indicator (Now compact and sleek) */}
          {isOfflineMode ? (
            <button
              onClick={toggleSimulatedOffline}
              type="button"
              className="flex items-center justify-center rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-all cursor-pointer w-12 h-12 border border-red-500/10"
              title="Mode hors-ligne actif. Cliquez pour reconnecter."
              id="header_offline_indicator"
            >
              <WifiOff className="w-5 h-5 text-red-500 animate-pulse" />
            </button>
          ) : syncQueue.length > 0 ? (
            <button
              onClick={triggerSync}
              type="button"
              className="flex items-center justify-center rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 transition-all animate-pulse cursor-pointer w-12 h-12 border border-amber-500/10"
              title={`${syncQueue.length} modification(s) en attente. Cliquez pour synchroniser.`}
              id="header_sync_indicator"
            >
              <RefreshCw className={`w-5 h-5 text-amber-500 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>
          ) : (
            <div 
              className="relative flex items-center justify-center rounded-full text-emerald-500 bg-emerald-500/10 w-12 h-12 border border-emerald-500/10 select-none cursor-help" 
              title="Connecté & Synchronisé avec le Cloud"
              id="header_online_indicator"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping absolute" />
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            </div>
          )}

          {/* Unified Notification Center Bell */}
          <NotificationCenter />

          {/* User Profile Multi-Menu Trigger & Tool dropdown (Consolidates: Profile, Agenda, Budget, System settings, Theme) */}
          <div className="relative" ref={profileMenuRef}>
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className={`flex items-center justify-center gap-1 rounded-full bg-slate-50 dark:bg-[#1a1a1d] hover:bg-slate-100 dark:hover:bg-slate-800 text-amber-700 dark:text-amber-400 border border-slate-205 dark:border-slate-800 active:scale-95 transition-all outline-none min-w-[48px] min-h-[48px] h-12 px-2.5 ${
                isProfileOpen ? 'ring-2 ring-amber-500' : ''
              }`}
              title="Menu FBO"
              id="header_profile_btn_dropdown"
            >
              <span className="w-8 h-8 rounded-full font-black text-xs bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center border border-amber-200/50 dark:border-amber-900/50 overflow-hidden shrink-0">
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
              </span>
              <ChevronDown className={`w-4 h-4 text-slate-500 dark:text-slate-400 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Profile Dropdown Menu */}
            {isProfileOpen && (
              <div 
                className="absolute right-0 mt-2.5 w-64 max-w-[calc(100vw-32px)] bg-white dark:bg-[#1f1f22] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-55 overflow-hidden text-left py-2"
                id="header_profile_dropdown"
              >
                {/* Profile Header Card */}
                <div className="px-4 py-2.5 bg-slate-50/50 dark:bg-[#1c1c1f]/40 border-b border-slate-100 dark:border-slate-800 mb-1.5 flex flex-col gap-0.5">
                  <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">
                    {profile.name}
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate font-semibold">
                    {profile.title || profile.companyName || 'Distributeur Indépendant'} {profile.fboId ? `• FBO N° ${profile.fboId}` : ''}
                  </p>
                  <p className="text-[8px] tracking-wide font-extrabold text-amber-600 dark:text-amber-500 uppercase mt-1 leading-none">
                    Grade: {GRADES.find(g => g.code === profile.grade)?.label || profile.grade}
                  </p>
                </div>

                {/* Primary Menu Actions */}
                <div className="space-y-0.5 px-1.5">
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      navigate('/profile');
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                      location.pathname === '/profile'
                        ? 'bg-amber-550/10 text-amber-500'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#25252a]/50'
                    }`}
                  >
                    <User className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    <span>Mon Profil FBO</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      navigate('/agenda');
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                      location.pathname === '/agenda'
                        ? 'bg-amber-550/10 text-amber-500'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#25252a]/50'
                    }`}
                  >
                    <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    <span>Agenda & Planner</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      navigate('/budget');
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                      location.pathname === '/budget'
                        ? 'bg-amber-550/10 text-amber-500'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#25252a]/50'
                    }`}
                  >
                    <Wallet className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    <span>Budget & Finances</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      navigate('/settings');
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                      location.pathname === '/settings'
                        ? 'bg-amber-550/10 text-amber-500'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#25252a]/50'
                    }`}
                  >
                    <Settings className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    <span>Paramètres Système</span>
                  </button>
                </div>

                {/* Theme Selector Segment inside profile box */}
                <div className="border-t border-slate-100 dark:border-slate-800 mt-2 pt-2 px-3">
                  <p className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-2">
                    Thème Actif
                  </p>
                  
                  <div className="grid grid-cols-3 gap-1 bg-slate-50 dark:bg-[#131316] rounded-xl p-1 border border-slate-100 dark:border-slate-800/80">
                    {(['light', 'dark', 'system'] as ThemeMode[]).map((mode) => {
                      const active = themeMode === mode;
                      return (
                        <button
                          key={mode}
                          onClick={() => handleSetTheme(mode)}
                          className={`py-1.5 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all text-[10px] font-bold cursor-pointer ${
                            active
                              ? 'bg-amber-500 text-slate-950 shadow-sm'
                              : 'text-slate-650 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                          }`}
                          title={`Activer le mode ${getThemeLabel(mode)}`}
                        >
                          {getThemeIcon(mode)}
                          <span className="text-[8px] leading-tight select-none">{getThemeLabel(mode)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}
          </div>

        </div>

      </div>
    </header>
  );
};
