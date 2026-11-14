import React from 'react';

export interface HeroCardProps {
  label: string;
  value: string;
  change?: string;
  positive?: boolean;
  icon?: React.ReactNode;
}

export const HeroCard: React.FC<HeroCardProps> = ({
  label,
  value,
  change,
  positive = true,
  icon,
}) => (
  <div className="hero-card">
    <div className="hero-card-top">
      <span className="hero-card-label">{label}</span>
      {icon && <div className="hero-card-icon">{icon}</div>}
    </div>
    <p className="hero-card-value">{value}</p>
    {change && (
      <p className={`hero-card-change ${positive ? 'is-positive' : 'is-negative'}`}>
        {positive ? '↑' : '↓'} {change}
      </p>
    )}
  </div>
);

export default HeroCard;