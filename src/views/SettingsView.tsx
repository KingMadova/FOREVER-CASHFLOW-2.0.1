import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/slices/authSlice';
import { useCustomersStore } from '../store/slices/customersSlice';
import { useOrdersStore } from '../store/slices/ordersSlice';
import { useBudgetStore } from '../store/slices/budgetSlice';
import { useProductsStore } from '../store/slices/productsSlice';
import { useSyncStore } from '../store/slices/syncSlice';
import { useBackupStore } from '../store/slices/backupSlice';
import { Card } from '../components/ui/Card';
import { ThemeMode } from '../types';
import { useActionFeedback } from '../hooks/useActionFeedback';
import './SettingsView.css';
import { ActivityReport } from '../components/ui/ActivityReport';
import { 
  Sliders,
  Moon,
  Sun,
  Laptop,
  Wifi,
  WifiOff,
  RefreshCw,
  Trash2,
  Download,
  Upload,
  AlertTriangle,
  FileText,
  LogOut
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { 
    profile,
    themeMode,
    setThemeMode,
    logout
  } = useAuthStore();
  const {
    isOfflineMode,
    isSimulatedOffline,
    toggleSimulatedOffline,
    syncQueue,
    isSyncing,
    triggerSync,
    retrySyncTask,
    dismissSyncTask,
  } = useSyncStore();
  const { customers } = useCustomersStore();
  const { orders } = useOrdersStore();
  const { budget } = useBudgetStore();
  const { importBackupData, hardResetData } = useBackupStore();
  const { purgePhantomProducts } = useProductsStore();

  const navigate = useNavigate();
  const { executeAction, confirmAction, isActionPending, notifySuccess, notifyError } = useActionFeedback();
  const isPurging = isActionPending('settings-purge-phantoms');
  const isSavingTheme = isActionPending('settings-theme');
  const isImporting = isActionPending('settings-import');
  const isResetting = isActionPending('settings-hard-reset');
  const isForcingSync = isActionPending('settings-force-sync');

  const handleThemeChange = async (mode: ThemeMode) => {
    await executeAction({
      actionKey: 'settings-theme',
      operation: () => setThemeMode(mode),
      successMessage: 'Paramètres mis à jour avec succès !',
      errorContext: 'Échec de la mise à jour du thème',
      redirectToDashboard: true,
    });
  };

  const handlePurgePhantoms = async () => {
    const confirmed = await confirmAction({
      title: 'Nettoyer les produits parasites',
      message: 'Supprimer les produits parasites du catalogue tout en conservant vos commandes existantes ?',
      confirmLabel: 'Oui, nettoyer',
      cancelLabel: 'Annuler',
      tone: 'warning',
    });
    if (!confirmed) return;

    await executeAction({
      actionKey: 'settings-purge-phantoms',
      operation: () => purgePhantomProducts(),
      successMessage: 'Produits parasites supprimés avec succès !',
      errorContext: 'Échec du nettoyage du catalogue',
      redirectToDashboard: true,
    });
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Data Actions: Export Backup
  const handleExportBackup = () => {
    try {
      const backupData = {
        customers: customers || [],
        orders: orders || [],
        budget: budget || [],
        profile: profile,
        exportDate: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FCF_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      notifySuccess('Fichier de sauvegarde téléchargé avec succès !');
    } catch {
      notifyError('Échec lors du téléchargement de la sauvegarde.');
    }
  };

  // Data Actions: Import Backup
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        await executeAction({
          actionKey: 'settings-import',
          operation: () => importBackupData(data),
          successMessage: 'Sauvegarde restaurée avec succès !',
          errorContext: 'Échec de la restauration de la sauvegarde',
          redirectToDashboard: true,
        });
      } catch {
        notifyError("Le fichier JSON sélectionné n'est pas une sauvegarde valide.");
      } finally {
        input.value = '';
      }
    };
    reader.readAsText(file);
  };

  // Data Actions: Hard Reset
  const handleHardReset = async () => {
    const confirmed = await confirmAction({
      title: "Réinitialiser l'application",
      message: 'Cette opération supprimera définitivement vos clients, commandes, budgets, rendez-vous et réinitialisera votre profil. Êtes-vous absolument sûr ?',
      confirmLabel: 'Oui, tout réinitialiser',
      cancelLabel: 'Annuler',
      tone: 'danger',
    });
    if (!confirmed) return;

    await executeAction({
      actionKey: 'settings-hard-reset',
      operation: () => hardResetData(),
      successMessage: 'Application réinitialisée avec succès !',
      errorContext: 'Échec de la réinitialisation des données',
      redirectToDashboard: true,
    });
  };

  const handleTriggerSync = async () => {
    await executeAction({
      actionKey: 'settings-force-sync',
      operation: async () => {
        await triggerSync();
        if (useSyncStore.getState().syncQueue.length > 0) {
          throw new Error('Certaines modifications restent en attente de synchronisation.');
        }
      },
      successMessage: 'Synchronisation terminée avec succès !',
      errorContext: 'Échec de la synchronisation',
      redirectToDashboard: true,
    });
  };

  return (
    <div className="space-y-6 text-left" id="settings_view_container">
      
      {/* Dynamic Header */}
      <div>
        <span className="text-[10px] uppercase font-bold text-amber-500 tracking-wider">Configuration Système</span>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">Paramètres d'Application</h2>
        <p className="text-xs text-slate-500">Ajustez l'apparence visuelle, gérez la synchronisation hors-ligne des données et effectuez des sauvegardes de sécurité.</p>
      </div>

      {/* SYSTEM PREFERENCES & APP OPTIONS */}
      <div className="space-y-6" id="settings_tab_system_content">
        
        {/* FBO Activity Performance Report Card */}
        <ActivityReport />

        {/* Theme Settings Card */}
        <Card className="p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1f1f22]">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-amber-500" />
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider leading-none">
                  Thématisation Visuelle de l'App
                </h3>
                <p className="text-[10px] text-slate-400 font-medium leading-none mt-1">
                  Déterminez l'apparence des interfaces et des graphiques.
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="py-2 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={isSavingTheme}
              onClick={() => handleThemeChange('light')}
              className={`py-3 px-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all text-xs font-bold cursor-pointer disabled:opacity-60 ${
                themeMode === 'light'
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500 shadow-sm'
                  : 'bg-slate-50 dark:bg-[#2a2a2e] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100/50'
              }`}
            >
              <Sun className="w-4 h-4" />
              <span>Clair (Jour)</span>
            </button>

            <button
              type="button"
              disabled={isSavingTheme}
              onClick={() => handleThemeChange('dark')}
              className={`py-3 px-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all text-xs font-bold cursor-pointer disabled:opacity-60 ${
                themeMode === 'dark'
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500 shadow-sm'
                  : 'bg-slate-50 dark:bg-[#2a2a2e] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100/50'
              }`}
            >
              <Moon className="w-4 h-4" />
              <span>Sombre (Nuit)</span>
            </button>

            <button
              type="button"
              disabled={isSavingTheme}
              onClick={() => handleThemeChange('system')}
              className={`py-3 px-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all text-xs font-bold cursor-pointer disabled:opacity-60 ${
                themeMode === 'system'
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500 shadow-sm'
                  : 'bg-slate-50 dark:bg-[#2a2a2e] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100/50'
              }`}
            >
              <Laptop className="w-4 h-4" />
              <span>Système (Auto)</span>
            </button>
          </div>
        </Card>

        {/* Connection & Synchronisation Console */}
        <Card className="p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1f1f22]">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              {isOfflineMode ? (
                <div className="p-1.5 rounded-lg bg-red-500/10 text-red-500 animate-pulse">
                  <WifiOff className="w-4 h-4" />
                </div>
              ) : (
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                  <Wifi className="w-4 h-4" />
                </div>
              )}
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider leading-none">
                  Status Réseau & Console Hors-ligne
                </h3>
                <p className="text-[10px] text-slate-400 font-medium leading-none mt-1">
                  Gérez la synchronisation et testez le fonctionnement hors-ligne.
                </p>
              </div>
            </div>

            {/* Toggle offline simulator on the fly */}
            <button
              type="button"
              onClick={toggleSimulatedOffline}
              className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 cursor-pointer shrink-0 ${
                isSimulatedOffline ? 'bg-red-500' : 'bg-slate-200 dark:bg-[#2a2a2e]'
              }`}
              title="Tirer le commutateur pour forcer hors-ligne"
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                isSimulatedOffline ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-50/50 dark:bg-[#151518]/50 border border-slate-150 dark:border-slate-850 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-705 dark:text-slate-350">
                <span>Connectivité active :</span>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                  isOfflineMode 
                    ? 'bg-red-500/10 text-red-500 border border-red-500/10' 
                    : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/10'
                }`}>
                  {isOfflineMode ? 'Hors-ligne délibéré' : 'Réseau opérationnel'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs font-bold text-slate-705 dark:text-slate-350">
                <span>File de synchronisation :</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  syncQueue.length > 0 ? 'bg-amber-500/10 text-amber-500 animate-pulse' : 'bg-slate-100 dark:bg-[#2a2a2e] text-slate-500'
                }`}>
                  {syncQueue.length} modification(s) en attente
                </span>
              </div>
            </div>

            {syncQueue.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Modifications à synchroniser
                </h4>
                <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/20 dark:bg-[#1a1a1d]/20 px-2.5">
                  {syncQueue.map((task) => {
                    const isPermanent = Boolean(task.permanentError);
                    const isBlocked = Boolean(task.blockedByTaskId);
                    const typeLabel =
                      task.type === 'CUSTOMER_INTERACTION'
                        ? 'Interaction'
                        : task.type === 'CUSTOMER'
                          ? 'Prospect'
                          : task.type === 'ORDER'
                            ? 'Vente'
                            : task.type === 'AGENDA'
                              ? 'Agenda'
                              : task.type === 'BUDGET'
                                ? 'Budget'
                                : 'Journal';
                    return (
                      <div key={task.id} className="py-2.5 space-y-1.5 text-[11px]">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 overflow-hidden">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase shrink-0 ${
                                task.type === 'CUSTOMER_INTERACTION'
                                  ? 'bg-emerald-500/10 text-emerald-600'
                                  : task.type === 'CUSTOMER'
                                    ? 'bg-indigo-500/10 text-indigo-500'
                                    : 'bg-pink-500/10 text-pink-500'
                              }`}
                            >
                              {typeLabel}
                            </span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                              {task.name}
                            </span>
                          </div>
                          <span
                            className={`text-[9px] font-bold select-none flex items-center gap-1 shrink-0 ${
                              isPermanent
                                ? 'text-rose-600 dark:text-rose-400'
                                : isBlocked
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-slate-400'
                            }`}
                          >
                            {isPermanent ? (
                              'Erreur permanente'
                            ) : isBlocked ? (
                              'Bloquée par parent'
                            ) : (
                              <>
                                <RefreshCw className="w-2.5 h-2.5 animate-spin text-slate-400" />
                                {task.retryCount ? `Reprise (${task.retryCount})` : "File d'attente"}
                              </>
                            )}
                          </span>
                        </div>

                        {(task.lastError || task.blockedReason) && (
                          <p className="text-[10px] text-rose-600 dark:text-rose-400 break-words">
                            {task.blockedReason || task.lastError}
                          </p>
                        )}

                        {(isPermanent || isBlocked) && (
                          <div className="flex items-center gap-2">
                            {!isBlocked && (
                              <button
                                type="button"
                                onClick={() => void retrySyncTask(task.id)}
                                disabled={isOfflineMode || isSyncing}
                                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 text-[10px] font-black cursor-pointer"
                              >
                                Réessayer
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => void dismissSyncTask(task.id)}
                              className="px-2.5 py-1 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-[10px] font-bold hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                            >
                              Ignorer et retirer
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {!isOfflineMode ? (
                  <button
                    type="button"
                    onClick={handleTriggerSync}
                    disabled={isSyncing || isForcingSync}
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-slate-950 text-xs font-black uppercase rounded-2xl flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[98]"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${(isSyncing || isForcingSync) ? 'animate-spin' : ''}`} />
                    {(isSyncing || isForcingSync) ? 'Synchronisation forcée...' : 'Forcer la synchronisation immédiatement'}
                  </button>
                ) : (
                  <div className="p-3 rounded-2xl bg-amber-500/5 border border-amber-500/15 text-[10px] text-amber-600 dark:text-amber-400 font-bold leading-relaxed">
                    ⚠️ L'application est actuellement hors-ligne. Rétablissez la liaison réseau (ou désactivez le simulateur ci-dessus) pour décharger la file d'attente locale vers les serveurs cloud.
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Database Backups & Portability */}
        <Card className="p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1f1f22]">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
            <FileText className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider leading-none">
                Sauvegarde & Portabilité des Données
              </h3>
              <p className="text-[10px] text-slate-400 font-medium leading-none mt-1">
                Exportez ou importez vos données en JSON pour l'autonomie et l'offline.
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-normal mb-4">
            Puisque l'application stocke les modifications en cache local, vous possédez un contrôle absolu sur votre base clients, vos budgets financiers et vos commandes FBO. Exportez régulièrement ou restaurez en cas de changement de navigateur.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleExportBackup}
              className="flex items-center gap-2 justify-center py-3.5 px-5 bg-slate-50 dark:bg-[#2a2a2e] hover:bg-amber-500 hover:text-slate-950 duration-200 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-black uppercase text-slate-700 dark:text-slate-350 cursor-pointer select-none"
            >
              <Download className="w-4 h-4" />
              <span>Sauvegarder (.JSON)</span>
            </button>

            <label className={`flex items-center gap-2 justify-center py-3.5 px-5 bg-slate-50 dark:bg-[#2a2a2e] hover:bg-amber-500 hover:text-slate-950 duration-200 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-black uppercase text-slate-700 dark:text-slate-350 cursor-pointer select-none ${isImporting ? 'opacity-60 pointer-events-none' : ''}`}>
              <Upload className="w-4 h-4" />
              <span>{isImporting ? 'Restauration...' : 'Restaurer une sauvegarde'}</span>
              <input 
                type="file" 
                accept=".json" 
                disabled={isImporting}
                onChange={handleImportBackup} 
                className="hidden" 
              />
            </label>
          </div>
        </Card>

        {/* Danger Zone */}
        <Card className="p-6 rounded-[2.5rem] border border-red-500/10 bg-red-500/5 dark:bg-red-950/5 space-y-4">
          <div className="flex items-center gap-2 border-b border-red-500/10 pb-3">
            <AlertTriangle className="w-5 h-5 text-red-500 animate-bounce" />
            <div>
              <h3 className="text-sm font-black text-red-600 dark:text-red-400 uppercase tracking-wider leading-none">
                Zone de Danger / Réinitialisation
              </h3>
              <p className="text-[10px] text-red-500/60 font-medium leading-none mt-1">
                Actions destructives de nettoyage de la base de données.
              </p>
            </div>
          </div>

          <p className="text-xs text-red-700/80 dark:text-red-400/80 leading-relaxed font-semibold">
            Cette action supprimera irrémédiablement l'intégralité du cache local : prospects enregistrés, commandes, rapports financiers et informations du profil utilisateur. Prenez soin de faire une sauvegarde JSON au préalable.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handlePurgePhantoms}
              disabled={isPurging}
              className="py-3 px-5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-xs font-black uppercase rounded-2xl transition-all cursor-pointer inline-flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              {isPurging ? 'Nettoyage en cours...' : 'Purger les produits parasites (onboarding)'}
            </button>

            <button
              type="button"
              onClick={handleHardReset}
              disabled={isResetting}
              className="py-3 px-5 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white text-xs font-black uppercase rounded-2xl transition-all cursor-pointer inline-flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              {isResetting ? 'Réinitialisation...' : "Réinitialiser l'application"}
            </button>
          </div>
        </Card>
      </div>

    </div>
  );
};