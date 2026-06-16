import React, { useState, useEffect } from 'react';
import { Download, X, Sparkles, Smartphone, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if the user has already dismissed the prompt in this session
    const isDismissed = localStorage.getItem('fcf-pwa-prompt-dismissed');
    
    // Check if app is already running in standalone mode
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches || 
                        (window.navigator as any).standalone === true;

    if (isInstalled) {
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Only show if not previously dismissed
      if (!isDismissed) {
        // Show after a small delay for better user experience
        const timer = setTimeout(() => {
          setIsVisible(true);
        }, 4000);
        return () => clearTimeout(timer);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Detect if app was successfully installed
    const handleAppInstalled = () => {
      console.log('Forever CashFlow was installed successfully');
      setDeferredPrompt(null);
      setIsVisible(false);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the native PWA install prompt
    await deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);

    // Discard the prompt since it can only be prompted once
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    // Persist dismissal
    try {
      localStorage.setItem('fcf-pwa-prompt-dismissed', 'true');
    } catch (e) {
      console.error(e);
    }
  };

  if (!isVisible || !deferredPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className="fixed z-50 bottom-24 left-4 right-4 sm:left-4 sm:right-auto sm:max-w-md bg-white/95 dark:bg-[#1a1a1d]/95 backdrop-blur-md border border-amber-500/25 dark:border-amber-500/15 shadow-2xl rounded-[24px] p-5 space-y-4"
        id="pwa-install-prompt-banner"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-white font-extrabold text-lg shadow-lg shadow-amber-500/20 shrink-0 select-none">
              FC
            </div>
            <div>
              <div className="flex items-center gap-1.5 select-none">
                <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                  Installer l'App
                </h4>
                <span className="flex items-center gap-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full">
                  <Sparkles className="w-2 h-2" />
                  PRO
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                Ajoutez l'application sur votre écran d'accueil pour une expérience ultra rapide, fluide et accessible hors-ligne.
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-400 cursor-pointer select-none transition-colors"
            title="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Specs highlight block */}
        <div className="grid grid-cols-2 gap-2 bg-[#fcfcfd]/60 dark:bg-[#131316]/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-850 select-none">
          <div className="flex items-center gap-1.5 text-[9.5px] font-bold text-slate-650 dark:text-slate-350">
            <Smartphone className="w-3.5 h-3.5 text-amber-500" />
            <span>Écran d'accueil natif</span>
          </div>
          <div className="flex items-center gap-1.5 text-[9.5px] font-bold text-slate-650 dark:text-slate-350">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Zéro stockage lourd</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleDismiss}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors cursor-pointer select-none"
          >
            Plus tard
          </button>
          
          <button
            onClick={handleInstallClick}
            className="flex-[2] py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/15 hover:shadow-amber-500/25 active:scale-[98] transition-all select-none"
          >
            <Download className="w-3.5 h-3.5 stroke-[2.5]" />
            Installer maintenant
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
