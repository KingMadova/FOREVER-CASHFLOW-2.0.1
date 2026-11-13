// src/components/ui/EmptyState.tsx
// État vide unifié pour listes, grilles et sections.
// Remplace trois patterns existants :
//   - Card className="text-center py-10" (Prospects)
//   - p-4 text-center text-slate-400 italic (Orders)
//   - text-center py-6 (Dashboard activities)
// NOTE : ce composant n'est consommé nulle part avant le Lot C/D.

import React from 'react';

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  variant?: 'card' | 'inline';
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  variant = 'card',
  className = '',
}) => {
  const wrapperClass =
    variant === 'card'
      ? 'flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/20 px-6 py-10 text-center'
      : 'flex flex-col items-center justify-center gap-2 py-6 text-center';

  return (
    <div className={[wrapperClass, className].filter(Boolean).join(' ')}>
      {icon && (
        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-1">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
        {title}
      </p>
      {description && (
        <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-2 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl active:scale-95 transition-all cursor-pointer"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

export default EmptyState;