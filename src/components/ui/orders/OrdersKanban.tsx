import React from 'react';
import { Order, OrderStatut } from '../../../types';
import { orderStatusLabel } from '../../../lib/orderStatusMeta';

export interface OrdersKanbanProps {
  orders: Order[];
  statuses: OrderStatut[];
  onOpen: (order: Order) => void;
}

export const OrdersKanban: React.FC<OrdersKanbanProps> = ({
  orders,
  statuses,
  onOpen,
}) => (
  <div className="orders-kanban" id="orders_kanban_board">
    {statuses.map((status) => {
      const column = orders.filter((o) => o.status === status);
      return (
        <section key={status} className="orders-kanban-column">
          <header className="orders-kanban-column-header">
            <strong>{orderStatusLabel(status)}</strong>
            <span>{column.length}</span>
          </header>
          <div className="orders-kanban-cards">
            {column.length === 0 ? (
              <p className="orders-kanban-empty">Aucune commande</p>
            ) : (
              column.map((ord) => (
                <button
                  key={ord.id}
                  type="button"
                  className="orders-kanban-card"
                  onClick={() => onOpen(ord)}
                  aria-label={`Ouvrir la commande ${ord.refCommande || ord.id}`}
                >
                  <span className="orders-kanban-ref">
                    {ord.refCommande || ord.id}
                  </span>
                  <strong>{ord.customerName}</strong>
                  <span className="orders-kanban-meta">
                    {ord.items.length} article(s) · {ord.paiement}
                  </span>
                  <b className="orders-kanban-amount">
                    {ord.totalRetail.toLocaleString('fr-FR')} FCFA
                  </b>
                  <small className="orders-kanban-meta">{ord.date}</small>
                </button>
              ))
            )}
          </div>
        </section>
      );
    })}
  </div>
);

export default OrdersKanban;