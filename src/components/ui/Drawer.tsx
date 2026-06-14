import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Drawer: React.FC<DrawerProps> = ({ isOpen, onClose, title, children }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center xl:items-center">
      
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 dark:bg-black/75 backdrop-blur-xs transition-opacity" 
        onClick={onClose}
      />

      {/* Sheet Content Container */}
      <div 
        className="relative w-full max-w-lg md:max-w-xl bg-white dark:bg-[#1f1f22] rounded-t-3xl xl:rounded-3xl shadow-2xl p-6 pb-8 border border-slate-100 dark:border-slate-800 transition-transform duration-300 transform translate-y-0 flex flex-col max-h-[85vh] xl:max-h-[80vh] z-10"
        role="dialog"
        aria-modal="true"
        id="app_drawer_panel"
      >
        {/* Handle for slide visualization on mobile */}
        <div className="w-12 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-4 xl:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 select-none">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-3 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 active:scale-95 transition-all outline-none min-w-[48px] min-h-[48px] flex items-center justify-center"
            aria-label="Fermer"
            id="drawer_close_btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Children Scope */}
        <div className="overflow-y-auto flex-1 pr-1 custom-scrollbar">
          {children}
        </div>

      </div>
    </div>
  );
};
