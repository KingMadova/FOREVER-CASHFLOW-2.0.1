// src/components/ui/StatusBadge.tsx
// Badge de statut de commande unifié. Consomme orderStatusMeta.
// Variants : les 7 statuts de OrderStatut. Tailles : sm, md.
// Dark mode géré par les classes Tailwind `dark:`.
// NOTE : ce composant n'est consommé nulle part avant le Lot D.
// Sa présence seule ne modifie aucun rendu.

import React from 'react';
import type { OrderStatut } from '../../types';
import { getOrderStatusMeta, type OrderStatusTone } from '../../lib/orderStatusMeta';

export interface StatusBadgeProps {
  status: OrderStatut;
  size?: 'sm' | 'md';
  showDot?: boolean;
  className?: string;
}

const TONE_CLASSES: Record<OrderStatusTone, { base: string; dot: string }> = {
  neutral: {
    base: 'bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300',
    dot:  'bg-slate-400 dark:bg-slate-500',
  },
  info: {
    base: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
    dot:  'bg-blue-500 dark:bg-blue-400',
  },
  success: {
    base: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
    dot:  'bg-emerald-500 dark:bg-emerald-400',
  },
  warning: {
    base: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
    dot:  'bg-amber-500 dark:bg-amber-400',
  },
  danger: {
    base: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400',
    dot:  'bg-red-500 dark:bg-red-400',
  },
  violet: {
    base: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400',
    dot:  'bg-violet-500 dark:bg-violet-400',
  },
};

const SIZE_CLASSES = {
  sm: 'text-[10px] px-1.5 py-0.5 gap-1',
  md: 'text-[11px] px-2 py-0.5 gap-1.5',
} as const;

const DOT_SIZE_CLASSES = {
  sm: 'w-1 h-1',
  md: 'w-1.5 h-1.5',
} as const;

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'sm',
  showDot = true,
  className = '',
}) => {
  const meta = getOrderStatusMeta(status);
  const tone = TONE_CLASSES[meta.tone];

  return (
    <span
      className={[
        'inline-flex items-center rounded-full font-bold uppercase tracking-wider whitespace-nowrap',
        SIZE_CLASSES[size],
        tone.base,
        className,
      ].filter(Boolean).join(' ')}
      aria-label={`Statut : ${meta.label}`}
    >
      {showDot && (
        <span
          className={['inline-block rounded-full flex-shrink-0', DOT_SIZE_CLASSES[size], tone.dot].join(' ')}
          aria-hidden="true"
        />
      )}
      {meta.label}
    </span>
  );
};

export default StatusBadge;