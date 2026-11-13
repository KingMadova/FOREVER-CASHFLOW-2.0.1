import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthStore } from '../../store/slices/authSlice';
import { useSyncStore } from '../../store/slices/syncSlice';
import { GRADES, ThemeMode } from '../../types';
import {
  X,
  LayoutDashboard,
  Users,
  ShoppingBag,
  Receipt,
  Target,
  TrendingUp,
  Wallet,
  Calendar,
  BookOpen,
  User,
  Settings,
  Sun,
  Moon,
  Monitor,
  LogOut,
  Wifi,
  WifiOff,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';

interface AppDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRIMARY_NAV = [
  { path: '/', label: 'Accueil', icon: LayoutDashboard },
  { path: '/clients', label: 'Clients', icon: Users },
  { path: '/orders', label: 'Commandes', icon: ShoppingBag },
  { path: '/sales', label: 'Ventes', icon: Receipt },
] as const;

const SECONDARY_NAV = [
  { path: '/prospects', label: 'Prospects', icon: Target },
  { path: '/projection', label: 'Projection', icon: TrendingUp },
  { path: '/budget', label: 'Budget & Trésorerie', icon: Wallet },
  { path: '/agenda', label: 'Agenda & Rappels', icon: Calendar },
  { path: '/tracker', label: 'Journal G4', icon: BookOpen },
] as const;

const ACCOUNT_NAV = [
  { path: '/profile', label: 'Mon Profil', icon: User },
  { path: '/settings', label: 'Paramètres', icon: Settings },
] as const;

export const AppDrawer: React.FC<AppDrawerProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, themeMode, setThemeMode, logout } = useAuthStore();
  const { isOfflineMode, syncQueue, isSyncing, triggerSync } = useSyncStore();

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const currentGrade = GRADES.find((g) => g.code === profile.grade) || GRADES[1];

  const handleNavigate = (path: string) => {
    navigate(path);
    onClose();
  };

  const handleLogout = async () => {
    onClose();
    await logout();
    navigate('/login');
  };

  const themeOptions: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
    { mode: 'light', label: 'Clair', icon: Sun },
    { mode: 'dark', label: 'Sombre', icon: Moon },
    { mode: 'system', label: 'Auto', icon: Monitor },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="app-drawer-backdrop"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            className="app-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menu de navigation"
          >
            <div className="app-drawer-header">
              <div className="app-drawer-user">
                <div className="app-drawer-avatar">
                  {profile.photoUrl ? (
                    <img src={profile.photoUrl} alt="" referrerPolicy="no-referrer" />
                  ) : (
                    <span>{profile.initials || 'FBO'}</span>
                  )}
                </div>
                <div className="app-drawer-user-info">
                  <strong>{profile.name || 'Forever FBO'}</strong>
                  <small>{currentGrade.label}</small>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="app-drawer-close"
                aria-label="Fermer le menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <button
              type="button"
              onClick={
                isOfflineMode || syncQueue.length === 0 || isSyncing
                  ? undefined
                  : triggerSync
              }
              disabled={isOfflineMode || isSyncing || syncQueue.length === 0}
              className={`app-drawer-network ${
                isOfflineMode
                  ? 'is-offline'
                  : syncQueue.length > 0
                    ? 'is-pending'
                    : 'is-online'
              }`}
            >
              {isOfflineMode ? (
                <WifiOff className="w-4 h-4" />
              ) : syncQueue.length > 0 ? (
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              ) : (
                <Wifi className="w-4 h-4" />
              )}
              <span>
                {isOfflineMode
                  ? 'Hors-ligne'
                  : isSyncing
                    ? 'Synchronisation…'
                    : syncQueue.length > 0
                      ? `${syncQueue.length} opération${syncQueue.length > 1 ? 's' : ''} en attente`
                      : 'En ligne'}
              </span>
            </button>

            <div className="app-drawer-body">
              <div className="app-drawer-section">
                <p className="app-drawer-section-label">Navigation</p>
                {PRIMARY_NAV.map((item) => {
                  const Icon = item.icon;
                  const active =
                    item.path === '/'
                      ? location.pathname === '/'
                      : location.pathname.startsWith(item.path);
                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => handleNavigate(item.path)}
                      className={`app-drawer-link ${active ? 'is-active' : ''}`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                      <ChevronRight className="w-4 h-4 app-drawer-chevron" />
                    </button>
                  );
                })}
              </div>

              <div className="app-drawer-section">
                <p className="app-drawer-section-label">Espaces de travail</p>
                {SECONDARY_NAV.map((item) => {
                  const Icon = item.icon;
                  const active = location.pathname.startsWith(item.path);
                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => handleNavigate(item.path)}
                      className={`app-drawer-link ${active ? 'is-active' : ''}`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                      <ChevronRight className="w-4 h-4 app-drawer-chevron" />
                    </button>
                  );
                })}
              </div>

              <div className="app-drawer-section">
                <p className="app-drawer-section-label">Compte</p>
                {ACCOUNT_NAV.map((item) => {
                  const Icon = item.icon;
                  const active = location.pathname.startsWith(item.path);
                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => handleNavigate(item.path)}
                      className={`app-drawer-link ${active ? 'is-active' : ''}`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                      <ChevronRight className="w-4 h-4 app-drawer-chevron" />
                    </button>
                  );
                })}
              </div>

              <div className="app-drawer-section">
                <p className="app-drawer-section-label">Apparence</p>
                <div className="app-drawer-theme">
                  {themeOptions.map(({ mode, label, icon: Icon }) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setThemeMode(mode)}
                      className={`app-drawer-theme-btn ${themeMode === mode ? 'is-active' : ''}`}
                      aria-label={`Thème ${label}`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="app-drawer-footer">
              <button
                type="button"
                onClick={handleLogout}
                className="app-drawer-logout"
              >
                <LogOut className="w-4 h-4" />
                <span>Se déconnecter</span>
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

export default AppDrawer;