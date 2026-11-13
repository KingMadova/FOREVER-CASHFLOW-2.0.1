// src/components/ui/SectionCard.tsx
// Wrapper présentationnel unifié pour les cartes, panneaux et sections.
// Remplace les `p-4 rounded-2xl`, `p-6 rounded-[2.5rem]`, `p-5 rounded-3xl`
// hétérogènes par trois variantes cohérentes avec la charte (~8-16 px de rayon).
// NOTE : ce composant n'est consommé nulle part avant le Lot E.

import React from 'react';

export type SectionCardVariant = 'compact' | 'panel' | 'plain';

export interface SectionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SectionCardVariant;
  as?: 'div' | 'section' | 'article' | 'aside';
  bordered?: boolean;
  hoverable?: boolean;
}

const VARIANT_CLASSES: Record<SectionCardVariant, string> = {
  // compact : sous-sections, listes, blocs internes — 12 px radius
  compact: 'p-4 rounded-xl',
  // panel : cartes principales, sections de page — 16 px radius
  panel:   'p-5 sm:p-6 rounded-2xl',
  // plain : aucun padding, l'appelant gère (pour wrapper d'une liste)
  plain:   '',
};

export const SectionCard: React.FC<SectionCardProps> = ({
  variant = 'panel',
  as = 'div',
  bordered = true,
  hoverable = false,
  className = '',
  children,
  ...props
}) => {
  const Tag = as as React.ElementType;

  const classes = [
    'bg-white dark:bg-[#1f1f22]',
    bordered ? 'border border-slate-200 dark:border-slate-800' : '',
    VARIANT_CLASSES[variant],
    hoverable
      ? 'transition-colors hover:border-slate-300 dark:hover:border-slate-700'
      : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <Tag className={classes} {...props}>
      {children}
    </Tag>
  );
};

export default SectionCard;