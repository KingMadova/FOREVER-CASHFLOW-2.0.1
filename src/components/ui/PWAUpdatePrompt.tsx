import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

const HOUR = 60 * 60 * 1000;

// Bandeau "Nouvelle version disponible" : l'utilisateur choisit quand recharger
// (un rechargement automatique effacerait une saisie en cours).
export const PWAUpdatePrompt: React.FC = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const check = () => {
        if (navigator.onLine) registration.update().catch(() => {});
      };
      // Vérification toutes les heures + à chaque retour sur l'app (PWA restée en arrière-plan)
      setInterval(check, HOUR);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      className="fixed left-3 right-3 xl:left-auto xl:right-6 xl:w-[380px] z-[80] bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl p-4"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
      id="pwa_update_prompt"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
          <RefreshCw className="w-4 h-4 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-0.5">
            Nouvelle version disponible
          </p>
          <p className="text-[13px] text-slate-300 leading-snug">
            Termine ta saisie en cours, puis mets à jour. L’app va se recharger.
          </p>
        </div>
        <button
          onClick={() => setNeedRefresh(false)}
          className="text-slate-500 hover:text-slate-200 p-1 -mr-1 -mt-1 cursor-pointer shrink-0"
          aria-label="Plus tard"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => updateServiceWorker(true)}
          className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold uppercase rounded-xl tracking-wide cursor-pointer active:scale-95 transition-all"
        >
          Mettre à jour
        </button>
        <button
          onClick={() => setNeedRefresh(false)}
          className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white text-[11px] font-bold uppercase rounded-xl tracking-wide cursor-pointer active:scale-95 transition-all"
        >
          Plus tard
        </button>
      </div>
    </div>
  );
};
