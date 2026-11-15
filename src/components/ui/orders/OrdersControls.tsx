import React, { useState } from 'react';
import { Download, Printer, X } from 'lucide-react';
import { OrderStatut } from '../../../types';
import { SortSelect } from '../SortSelect';
import { ORDER_SORT_OPTIONS } from '../../../lib/sortHelper';

type FilterValue = 'ALL' | OrderStatut;

export interface OrdersControlOption {
  value: FilterValue;
  label: string;
}

export interface OrdersControlsProps {
  options: OrdersControlOption[];
  statusFilter: FilterValue;
  onChange: (value: FilterValue) => void;
  countFor: (value: FilterValue) => number;
  viewMode: 'list' | 'kanban';
  onViewModeChange: (mode: 'list' | 'kanban') => void;
  sortKey: string;
  onSortChange: (key: string) => void;
  onExportCSV: () => void;
  onPrintRegistry: () => void;
}

const SEGMENTED_FIXED: FilterValue[] = ['ALL', 'PENDING', 'VALIDATED'];
const SEGMENTED_OTHERS: FilterValue[] = ['PAYE', 'LIVRE', 'CANCELLED', 'RETOUR', 'REMPLACEMENT'];

// Labels courts — indispensables sur mobile pour que les 4 colonnes
// du segmented control restent équilibrées. N'a aucun impact sur la
// logique métier ni sur le filtrage.
const SEGMENTED_SHORT_LABELS: Record<FilterValue, string> = {
  ALL: 'Toutes',
  PENDING: 'Attente',
  VALIDATED: 'Validées',
  PAYE: 'Payées',
  LIVRE: 'Livrées',
  CANCELLED: 'Annulées',
  RETOUR: 'Retours',
  REMPLACEMENT: 'Rempl.',
};

export const OrdersControls: React.FC<OrdersControlsProps> = ({
  options,
  statusFilter,
  onChange,
  countFor,
  viewMode,
  onViewModeChange,
  sortKey,
  onSortChange,
  onExportCSV,
  onPrintRegistry,
}) => {
  const [isOthersOpen, setIsOthersOpen] = useState(false);

  const labelFor = (value: FilterValue): string =>
    options.find((o) => o.value === value)?.label ?? String(value);

  const shortLabelFor = (value: FilterValue): string =>
    SEGMENTED_SHORT_LABELS[value] ?? labelFor(value);

  const othersTotal = SEGMENTED_OTHERS.reduce((s, v) => s + countFor(v), 0);
  const currentIsOther = SEGMENTED_OTHERS.includes(statusFilter);
  const othersLabel = currentIsOther ? shortLabelFor(statusFilter) : 'Autres';

  return (
    <div className="orders-controls">
      {/* Desktop : chips scroll */}
      <div className="orders-filter-chips" id="orders_filter_group">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`orders-filter-chip ${statusFilter === opt.value ? 'is-active' : ''}`}
          >
            {opt.label}
            <span className="orders-filter-chip-count">{countFor(opt.value)}</span>
          </button>
        ))}
      </div>

      {/* Mobile : segmented 3 fixes + 1 "Autres" */}
      <div className="orders-segmented" role="group" aria-label="Filtrer par statut">
        {SEGMENTED_FIXED.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={`orders-segmented-btn ${statusFilter === value ? 'is-active' : ''}`}
            title={labelFor(value)}
          >
            <span className="orders-segmented-label">{shortLabelFor(value)}</span>
            <small>{countFor(value)}</small>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setIsOthersOpen(true)}
          className={`orders-segmented-btn ${currentIsOther ? 'is-active' : ''}`}
          title={currentIsOther ? labelFor(statusFilter) : 'Autres statuts'}
        >
          <span className="orders-segmented-label">{othersLabel}</span>
          <small>{currentIsOther ? countFor(statusFilter) : othersTotal}</small>
        </button>
      </div>

      {/* Toolbar commune */}
      <div className="orders-toolbar">
        <div className="orders-view-switch" role="group" aria-label="Mode d'affichage">
          <button
            type="button"
            className={viewMode === 'list' ? 'is-active' : ''}
            onClick={() => onViewModeChange('list')}
          >
            Liste
          </button>
          <button
            type="button"
            className={viewMode === 'kanban' ? 'is-active' : ''}
            onClick={() => onViewModeChange('kanban')}
          >
            Kanban
          </button>
        </div>
        <div className="orders-toolbar-spacer" />
        <div className="orders-toolbar-sort">
          <SortSelect
            options={ORDER_SORT_OPTIONS}
            value={sortKey}
            onChange={onSortChange}
            id="orders_sort_select"
          />
        </div>
        <button
          type="button"
          onClick={onExportCSV}
          className="orders-utility-button"
          aria-label="Exporter les commandes en CSV"
        >
          <Download size={14} />
          <span className="orders-utility-label">CSV</span>
        </button>
        <button
          type="button"
          onClick={onPrintRegistry}
          className="orders-utility-button"
          aria-label="Imprimer le registre en PDF"
        >
          <Printer size={14} />
          <span className="orders-utility-label">PDF</span>
        </button>
      </div>

      {/* Sheet mobile "Autres statuts" — utilise les labels LONGS (assez de place) */}
      {isOthersOpen && (
        <div
          className="orders-other-backdrop"
          onClick={() => setIsOthersOpen(false)}
          role="presentation"
        >
          <section
            className="orders-other-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Autres statuts"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="orders-other-handle" />
            <div className="orders-other-heading">
              <strong>Autres statuts</strong>
              <button
                type="button"
                onClick={() => setIsOthersOpen(false)}
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="orders-other-list">
              {SEGMENTED_OTHERS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    onChange(value);
                    setIsOthersOpen(false);
                  }}
                  className={`orders-other-item ${statusFilter === value ? 'is-active' : ''}`}
                >
                  {labelFor(value)}
                  <span>{countFor(value)}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default OrdersControls;