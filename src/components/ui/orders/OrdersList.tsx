import React from 'react';
import { ChevronRight, Layers } from 'lucide-react';
import { Order, OrderStatut } from '../../../types';
import { isCountedOrder } from '../../../lib/orderStats';
import { orderStatusLabel } from '../../../lib/orderStatusMeta';
import { formatCC, formatMoney, formatSignedMoney } from '../../../lib/format';

export interface OrdersListProps {
  orders: Order[];
  onOpen: (order: Order) => void;
}

const STATUS_TONE: Record<OrderStatut, string> = {
  PENDING: 'is-pending',
  VALIDATED: 'is-validated',
  PAYE: 'is-paye',
  LIVRE: 'is-livre',
  CANCELLED: 'is-cancelled',
  RETOUR: 'is-retour',
  REMPLACEMENT: 'is-remplacement',
};

export const OrdersList: React.FC<OrdersListProps> = ({ orders, onOpen }) => {
  if (orders.length === 0) {
    return (
      <div className="orders-empty" id="orders_mapping_area">
        <p className="orders-empty-title">Aucune commande dans cette vue</p>
        <p className="orders-empty-description">
          Changez de filtre ou créez une nouvelle commande pour commencer.
        </p>
      </div>
    );
  }

  return (
    <div className="orders-list" id="orders_mapping_area">
      {orders.map((ord) => {
        const tone = STATUS_TONE[ord.status];
        const displayDate =
          ord.status === 'VALIDATED' ? ord.validatedAt || ord.date : ord.date;
        return (
          <button
            key={ord.id}
            type="button"
            onClick={() => onOpen(ord)}
            className="order-row"
            id={`order_card_${ord.id}`}
            aria-label={`Ouvrir la commande de ${ord.customerName}`}
          >
            <div className={`order-row-icon ${tone}`}>
              <Layers size={16} />
            </div>

            <div className="order-row-body">
              <div className="order-row-top">
                <span className="order-row-date">{displayDate}</span>
                <span className={`order-row-status ${tone}`}>{orderStatusLabel(ord.status)}</span>
                {ord.synced === false && (
                  <span className="order-row-offline">Hors ligne</span>
                )}
              </div>

              <h3 className="order-row-customer">{ord.customerName}</h3>

              <p className="order-row-summary">
                {ord.refCommande || ord.id} · {ord.items.length} article(s) ·{' '}
                {formatCC(ord.totalCC)}
              </p>

              <div className="order-row-financials">
                <strong className="order-row-total">
                  {formatMoney(ord.totalRetail)}
                </strong>
                {isCountedOrder(ord) && (
                  <span className="order-row-margin">
                    {formatSignedMoney(ord.totalMargin)} marge
                  </span>
                )}
              </div>
            </div>

            <ChevronRight className="order-row-chevron" size={18} />
          </button>
        );
      })}
    </div>
  );
};

export default OrdersList;