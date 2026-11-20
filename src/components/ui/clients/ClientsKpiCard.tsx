import React from 'react';

export type ClientsKpiTone = 'gold' | 'emerald' | 'blue' | 'violet' | 'rose';

export interface ClientsKpiCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  tone?: ClientsKpiTone;
}

export const ClientsKpiCard: React.FC<ClientsKpiCardProps> = ({
  label,
  value,
  hint,
  icon,
  tone = 'gold',
}) => (
  <article className="clients-kpi-card">
    <header className="clients-kpi-header">
      <span className="clients-kpi-label">{label}</span>
      <span className={`clients-kpi-icon is-${tone}`} aria-hidden="true">
        {icon}
      </span>
    </header>
    <p className="clients-kpi-value">{value}</p>
    {hint && <p className="clients-kpi-hint">{hint}</p>}
  </article>
);

export default ClientsKpiCard;