import React from 'react';

export type ProgressRowTone = 'gold' | 'emerald' | 'blue' | 'rose' | 'violet';

export interface ProgressRowProps {
  icon: React.ReactNode;
  label: string;
  current: number;
  target: number;
  format?: (n: number) => string;
  tone?: ProgressRowTone;
  onClick?: () => void;
}

const TONE_BAR: Record<ProgressRowTone, string> = {
  gold: 'progress-bar-fill is-gold',
  emerald: 'progress-bar-fill is-emerald',
  blue: 'progress-bar-fill is-blue',
  rose: 'progress-bar-fill is-rose',
  violet: 'progress-bar-fill is-violet',
};

export const ProgressRow: React.FC<ProgressRowProps> = ({
  icon,
  label,
  current,
  target,
  format = (n) => String(Math.round(n)),
  tone = 'gold',
  onClick,
}) => {
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`progress-row ${onClick ? 'is-clickable' : ''}`}
    >
      <div className="progress-row-top">
        <div className="progress-row-icon">{icon}</div>
        <span className="progress-row-label">{label}</span>
        <span className="progress-row-value">
          {format(current)}
          {target > 0 && <> / {format(target)}</>}
        </span>
      </div>
      <div className="progress-row-track">
        <div className={TONE_BAR[tone]} style={{ width: `${pct}%` }} />
      </div>
      <p className="progress-row-percent">
        {target > 0 ? `${Math.round(pct)}% atteint` : 'Définir un objectif →'}
      </p>
    </Tag>
  );
};

export default ProgressRow;