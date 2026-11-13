// src/components/ui/PageShell.tsx
// En-tête de page générique : eyebrow + titre + sous-titre + actions.
// Remplace les cinq reconstructions manuelles de `crm-page-header`
// (Prospects, Clients, Orders, Budget, Agenda) — migration au Lot D/E.
// NOTE : ce composant n'est consommé nulle part avant le Lot D.
// Le composant PageHeader existant (barre supérieure globale) reste inchangé.

import React from 'react';

export interface PageShellProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  id?: string;
}

export const PageShell: React.FC<PageShellProps> = ({
  eyebrow,
  title,
  subtitle,
  actions,
  children,
  className = '',
  id,
}) => {
  return (
    <div id={id} className={['w-full', className].filter(Boolean).join(' ')}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[10px] uppercase font-bold text-amber-500 tracking-wider mb-0.5">
              {eyebrow}
            </p>
          )}
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-tight truncate">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
              {subtitle}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2 flex-wrap shrink-0 sm:justify-end">
            {actions}
          </div>
        )}
      </div>

      {children && <div className="mt-3">{children}</div>}
    </div>
  );
};

export default PageShell;