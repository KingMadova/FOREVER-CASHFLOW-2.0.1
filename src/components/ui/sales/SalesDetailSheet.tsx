import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Receipt } from 'lucide-react';
import { Order } from '../../../types';
import { orderAccountingDate } from '../../../lib/orderStats';
import './SalesDetailSheet.css';

export interface SalesDetailSummary {
  label: string;
  value: string;
}

export interface SalesDetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  summary?: SalesDetailSummary[];
  orders: Order[];
  emptyMessage?: string;
}

const money = (n: number) =>
  `${Math.round(n || 0).toLocaleString('fr-FR').replace(/\u202f/g, ' ')} FCFA`;

const dateLabel = (value: string) => {
  if (!value) return '—';
  const d = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
};

const paymentLabel: Record<string, string> = {
  ESPECES: 'Espèces',
  AIRTEL: 'Airtel Money',
  MTN: 'MTN MoMo',
  VIREMENT: 'Virement',
  MIXTE: 'Mixte',
  AUTRE: 'Autre',
};

export const SalesDetailSheet: React.FC<SalesDetailSheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  summary = [],
  orders,
  emptyMessage = 'Aucune commande dans cette vue.',
}) => {
  // Body scroll lock + Escape
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
    <div
      className="sales-detail-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <section
        className="sales-detail-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sales-detail-handle" aria-hidden="true" />

        <header className="sales-detail-header">
          <div>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="sales-detail-close"
          >
            <X size={18} />
          </button>
        </header>

        {summary.length > 0 && (
          <div className="sales-detail-summary">
            {summary.map((s) => (
              <div key={s.label}>
                <span>{s.label}</span>
                <strong>{s.value}</strong>
              </div>
            ))}
          </div>
        )}

        <div className="sales-detail-body">
          {orders.length === 0 ? (
            <p className="sales-detail-empty">{emptyMessage}</p>
          ) : (
            orders.map((order) => {
              const paid = Math.min(
                order.totalRetail,
                Math.max(0, order.amountPaid ?? order.totalRetail),
              );
              const showPaid = paid !== order.totalRetail;
              return (
                <div key={order.id} className="sales-detail-row">
                  <span className={`sales-detail-icon is-${order.status.toLowerCase()}`}>
                    <Receipt size={14} />
                  </span>
                  <div className="sales-detail-main">
                    <strong>{order.customerName}</strong>
                    <span>
                      {order.refCommande || order.id} ·{' '}
                      {dateLabel(orderAccountingDate(order))}
                    </span>
                    <span className="sales-detail-pay">
                      {paymentLabel[order.paiement] || order.paiement}
                    </span>
                  </div>
                  <div className="sales-detail-trailing">
                    <strong>{money(order.totalRetail)}</strong>
                    {showPaid && (
                      <span className="sales-detail-paid">Encaissé {money(paid)}</span>
                    )}
                    <span className={`sales-detail-status is-${order.status.toLowerCase()}`}>
                      {order.status === 'PAYE' ? 'Payée' : 'Validée'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
};

export default SalesDetailSheet;