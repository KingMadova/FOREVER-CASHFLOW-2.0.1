import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  CheckCircle2,
  X,
  XCircle,
} from 'lucide-react';
import { useFeedbackStore } from '../../store/slices/feedbackSlice';

export const FeedbackHost: React.FC = () => {
  const {
    notifications,
    dismissNotification,
    confirmRequest,
    resolveConfirm,
  } = useFeedbackStore();

  useEffect(() => {
    if (!confirmRequest) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        resolveConfirm(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmRequest, resolveConfirm]);

  return (
    <>
      {/* Global Toast Container — responsive mobile & desktop */}
      <div
        id="global_feedback_toast_container"
        aria-live="polite"
        className="fixed top-4 left-4 right-4 sm:left-auto sm:top-5 sm:right-6 sm:w-full sm:max-w-md z-[100] flex flex-col gap-2.5 pointer-events-none"
      >
        <AnimatePresence>
          {notifications.map((item) => {
            const isSuccess = item.type === 'success';
            const isError = item.type === 'error';

            const styleClasses = isSuccess
              ? 'bg-white/95 dark:bg-[#1a1a1d]/95 border-emerald-500/40 text-slate-900 dark:text-slate-100 shadow-emerald-500/10'
              : isError
                ? 'bg-white/95 dark:bg-[#1a1a1d]/95 border-rose-500/45 text-slate-900 dark:text-slate-100 shadow-rose-500/15'
                : 'bg-white/95 dark:bg-[#1a1a1d]/95 border-amber-500/45 text-slate-900 dark:text-slate-100 shadow-amber-500/15';

            const iconBoxClasses = isSuccess
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              : isError
                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400';

            return (
              <motion.div
                key={item.id}
                role={isError ? 'alert' : 'status'}
                data-feedback-type={item.type}
                initial={{ opacity: 0, y: -16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.96 }}
                transition={{ duration: 0.18 }}
                className={`pointer-events-auto rounded-2xl border backdrop-blur-md shadow-2xl p-3.5 sm:p-4 flex items-start gap-3 ${styleClasses}`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBoxClasses}`}>
                  {isSuccess ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : isError ? (
                    <XCircle className="w-5 h-5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5" />
                  )}
                </div>

                <div className="flex-1 min-w-0 text-left">
                  <p className={`text-[10px] font-black uppercase tracking-wider ${
                    isSuccess
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : isError
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-amber-600 dark:text-amber-400'
                  }`}>
                    {item.title || (isSuccess ? 'Confirmation' : isError ? 'Erreur' : 'Attention')}
                  </p>
                  <p className="text-xs font-bold leading-snug text-slate-800 dark:text-slate-100 mt-0.5 break-words">
                    {item.message}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => dismissNotification(item.id)}
                  aria-label="Fermer la notification"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Global Pre-Action Confirmation Modal (Deletions / Sensitive actions) */}
      <AnimatePresence>
        {confirmRequest && (
          <div
            id="global_confirm_dialog_backdrop"
            className="fixed inset-0 z-[110] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="global_confirm_dialog_title"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-md bg-white dark:bg-[#1f1f22] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 space-y-4 text-left"
              id="global_confirm_dialog"
            >
              <div className="flex items-start gap-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                  confirmRequest.options.tone === 'warning'
                    ? 'bg-amber-500/15 text-amber-500'
                    : 'bg-rose-500/15 text-rose-500'
                }`}>
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3
                    id="global_confirm_dialog_title"
                    className="text-sm font-black uppercase tracking-wide text-slate-900 dark:text-slate-100"
                  >
                    {confirmRequest.options.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                    {confirmRequest.options.message}
                  </p>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => resolveConfirm(false)}
                  className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-2xl transition-all cursor-pointer"
                  id="global_confirm_cancel_btn"
                >
                  {confirmRequest.options.cancelLabel || 'Annuler'}
                </button>
                <button
                  type="button"
                  onClick={() => resolveConfirm(true)}
                  className={`flex-1 py-3 px-4 font-black text-xs rounded-2xl transition-all active:scale-95 cursor-pointer shadow-lg ${
                    confirmRequest.options.tone === 'warning'
                      ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                      : 'bg-rose-600 hover:bg-rose-700 text-white'
                  }`}
                  id="global_confirm_accept_btn"
                >
                  {confirmRequest.options.confirmLabel || 'Confirmer'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
