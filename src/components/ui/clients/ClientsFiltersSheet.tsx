import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Star, Users, UserPlus, Bell, Download } from 'lucide-react';

export type ClientView = 'ALL' | 'VIP' | 'NO_ORDER' | 'RELANCE';

export interface ClientsFiltersSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeView: ClientView;
  onChangeView: (view: ClientView) => void;
  counts: Record<ClientView, number>;
  selectedMonth: number;
  selectedYear: number;
  onChangeMonth: (month: number) => void;
  onChangeYear: (year: number) => void;
  years: number[];
  months: { value: number; label: string }[];
  onExportVipPDF: () => void;
  showVipExport: boolean;
}

const VIEW_OPTIONS: {
  value: ClientView;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: 'ALL',
    label: 'Tous les clients',
    description: 'Portefeuille complet',
    icon: <Users size={16} />,
  },
  {
    value: 'VIP',
    label: 'Clients VIP',
    description: 'Top achats du mois ou fidèles',
    icon: <Star size={16} />,
  },
  {
    value: 'RELANCE',
    label: 'À relancer',
    description: 'Aucun contact depuis plus de 30 jours',
    icon: <Bell size={16} />,
  },
  {
    value: 'NO_ORDER',
    label: 'Sans achat',
    description: 'Aucune commande enregistrée',
    icon: <UserPlus size={16} />,
  },
];

export const ClientsFiltersSheet: React.FC<ClientsFiltersSheetProps> = ({
  isOpen,
  onClose,
  activeView,
  onChangeView,
  counts,
  selectedMonth,
  selectedYear,
  onChangeMonth,
  onChangeYear,
  years,
  months,
  onExportVipPDF,
  showVipExport,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="clients-filters-backdrop" onClick={onClose} role="presentation">
      <section
        className="clients-filters-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Filtres et vue clients"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="clients-filters-handle" aria-hidden="true" />

        <header className="clients-filters-header">
          <strong>Filtres</strong>
          <button type="button" onClick={onClose} aria-label="Fermer">
            <X size={16} />
          </button>
        </header>

        <div className="clients-filters-section">
          <p className="clients-filters-section-label">Vue</p>
          <div className="clients-filters-views">
            {VIEW_OPTIONS.map((opt) => {
              const active = activeView === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChangeView(opt.value)}
                  className={`clients-filters-view ${active ? 'is-active' : ''}`}
                  aria-pressed={active}
                >
                  <span className="clients-filters-view-icon" aria-hidden="true">
                    {opt.icon}
                  </span>
                  <span className="clients-filters-view-body">
                    <strong>{opt.label}</strong>
                    <small>{opt.description}</small>
                  </span>
                  <span className="clients-filters-view-count">{counts[opt.value]}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="clients-filters-section">
          <p className="clients-filters-section-label">Période</p>
          <div className="clients-filters-period">
            <label>
              <span>Mois</span>
              <select
                value={selectedMonth}
                onChange={(e) => onChangeMonth(Number(e.target.value))}
              >
                {months.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Année</span>
              <select
                value={selectedYear}
                onChange={(e) => onChangeYear(Number(e.target.value))}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {showVipExport && (
          <div className="clients-filters-section">
            <p className="clients-filters-section-label">Rapport</p>
            <button
              type="button"
              onClick={() => {
                onExportVipPDF();
                onClose();
              }}
              className="clients-filters-export"
            >
              <Download size={14} />
              Rapport VIP PDF
            </button>
          </div>
        )}

        <button type="button" onClick={onClose} className="clients-filters-done">
          Appliquer
        </button>
      </section>
    </div>,
    document.body,
  );
};

export default ClientsFiltersSheet;