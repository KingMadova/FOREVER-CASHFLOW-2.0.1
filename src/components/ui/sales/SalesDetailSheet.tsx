import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Receipt } from 'lucide-react';
import { Order } from '../../../types';
import { orderAccountingDate } from '../../../lib/orderStats';
import { inspectOrderNetAmount } from '../../../lib/salesReports';
import { formatMoney } from '../../../lib/format';

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
  highlightProductKey?: string;
}


const money = (n: number) => formatMoney(n);

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
  highlightProductKey,
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
              const inspectedNet = inspectOrderNetAmount(order);
              const showNetValue =
                inspectedNet.status === 'VALID' &&
                inspectedNet.amount !== null &&
                inspectedNet.amount !== order.totalRetail;
              const matchingLines = highlightProductKey
                ? (order.items || []).filter((item) => {
                    const key =
                      (item.productId || '').trim() ||
                      (item.productName || '').trim().toLocaleLowerCase('fr-FR');
                    return key === highlightProductKey && item.quantity > 0;
                  })
                : [];
              const productQty = matchingLines.reduce((s, item) => s + item.quantity, 0);
              const productLineTotal = matchingLines.reduce(
                (s, item) => s + item.unitPrice * item.quantity,
                0,
              );
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
                      {highlightProductKey && productQty > 0
                        ? ` · Qté produit : ${productQty} (cat. ${money(productLineTotal)})`
                        : ''}
                    </span>
                  </div>
                  <div className="sales-detail-trailing">
                    <strong>{money(order.totalRetail)}</strong>
                    {showNetValue && (
                      <span className="sales-detail-paid">Net bon {money(inspectedNet.amount!)}</span>
                    )}
                    {inspectedNet.status === 'MISSING' && (
                      <span className="sales-detail-pay">Net bon : non renseigné</span>
                    )}
                    {inspectedNet.status === 'INVALID' && (
                      <span className="sales-detail-status">Net bon invalide</span>
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