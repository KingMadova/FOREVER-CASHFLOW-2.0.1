import React from 'react';
import { ChevronRight } from 'lucide-react';

export type StatRowTone = 'gold' | 'emerald' | 'blue' | 'rose' | 'violet' | 'slate';

export interface StatRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: StatRowTone;
  onClick?: () => void;
}

const TONE_CLASS: Record<StatRowTone, string> = {
  gold: 'stat-row-icon is-gold',
  emerald: 'stat-row-icon is-emerald',
  blue: 'stat-row-icon is-blue',
  rose: 'stat-row-icon is-rose',
  violet: 'stat-row-icon is-violet',
  slate: 'stat-row-icon is-slate',
};

export const StatRow: React.FC<StatRowProps> = ({
  icon,
  label,
  value,
  hint,
  tone = 'gold',
  onClick,
}) => {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`stat-row ${onClick ? 'is-clickable' : ''}`}
    >
      <div className={TONE_CLASS[tone]}>{icon}</div>
      <div className="stat-row-body">
        <p className="stat-row-label">{label}</p>
        {hint && <p className="stat-row-hint">{hint}</p>}
      </div>
      <p className="stat-row-value">{value}</p>
      {onClick && <ChevronRight size={16} className="stat-row-chevron" />}
    </Tag>
  );
};

export default StatRow;