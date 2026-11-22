import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, ShieldCheck, UserCheck, X } from 'lucide-react';
import { SalesExportMode } from '../../../lib/salesReports';
import './SalesExportDialog.css';

export interface SalesExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  ordersCount: number;
  periodLabel: string;
  hasSearchQuery: boolean;
  onExport: (mode: SalesExportMode) => void;
}

export const SalesExportDialog: React.FC<SalesExportDialogProps> = ({
  isOpen,
  onClose,
  ordersCount,
  periodLabel,
  hasSearchQuery,
  onExport,
}) => {
  const [selectedMode, setSelectedMode] = useState<SalesExportMode>('nominatif');

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
    <div className="sales-export-backdrop" onClick={onClose} role="presentation">
      <section
        className="sales-export-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sales_export_dialog_title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sales-export-handle" aria-hidden="true" />

        <header className="sales-export-header">
          <div>
            <h3 id="sales_export_dialog_title">Exporter les ventes (CSV)</h3>
            <p>
              {ordersCount} commande{ordersCount > 1 ? 's' : ''} comptabilisée
              {ordersCount > 1 ? 's' : ''} · {periodLabel}
              {hasSearchQuery ? ' · Filtre recherche actif' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la fenêtre d'export"
            className="sales-export-close"
          >
            <X size={18} />
          </button>
        </header>

        <div className="sales-export-body">
          <p className="sales-export-intro">
            Choisissez le niveau de confidentialité avant le téléchargement. Seules les commandes
            validées et payées (hors annulations et retours) sont incluses.
          </p>

          <div className="sales-export-options" role="radiogroup" aria-label="Format d'exportation">
            <button
              type="button"
              role="radio"
              aria-checked={selectedMode === 'nominatif'}
              onClick={() => setSelectedMode('nominatif')}
              className={`sales-export-option ${selectedMode === 'nominatif' ? 'is-selected' : ''}`}
              id="sales_export_mode_nominatif"
            >
              <span className="sales-export-option-icon is-nominatif" aria-hidden="true">
                <UserCheck size={16} />
              </span>
              <div className="sales-export-option-content">
                <strong>Export nominatif</strong>
                <small>
                  Inclut nom du client, téléphone, e-mail, ville, référence paiement, notes et détail
                  ligne par ligne (produits, quantités, prix unitaires, totaux, marge).
                </small>
              </div>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={selectedMode === 'anonymise'}
              onClick={() => setSelectedMode('anonymise')}
              className={`sales-export-option ${selectedMode === 'anonymise' ? 'is-selected' : ''}`}
              id="sales_export_mode_anonymise"
            >
              <span className="sales-export-option-icon is-anonymise" aria-hidden="true">
                <ShieldCheck size={16} />
              </span>
              <div className="sales-export-option-content">
                <strong>Export anonymisé</strong>
                <small>
                  Supprime toute donnée personnelle (nom, téléphone, e-mail, ville, adresse, notes,
                  réf. paiement) et remplace le client par un identifiant anonyme (Client #001).
                </small>
              </div>
            </button>
          </div>

          {ordersCount === 0 && (
            <div className="sales-export-empty-warning">
              Aucune commande comptabilisée ne correspond aux filtres actifs.
            </div>
          )}
        </div>

        <footer className="sales-export-footer">
          <button type="button" onClick={onClose} className="sales-export-cancel">
            Annuler
          </button>
          <button
            type="button"
            disabled={ordersCount === 0}
            onClick={() => onExport(selectedMode)}
            className="sales-export-confirm"
            id="sales_export_confirm_btn"
          >
            <Download size={14} />
            {selectedMode === 'nominatif'
              ? 'Télécharger (Nominatif)'
              : 'Télécharger (Anonymisé)'}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
};
