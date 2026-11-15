import React from 'react';
import { Plus } from 'lucide-react';

export interface OrdersHeaderProps {
  description: string;
  count: number;
  onCreate: () => void;
}

export const OrdersHeader: React.FC<OrdersHeaderProps> = ({
  description,
  count,
  onCreate,
}) => (
  <div className="orders-header">
    <div className="orders-header-text">
      <p className="orders-header-description">
        {description}
        <span className="orders-header-count">{count}</span>
      </p>
    </div>
    <button
      type="button"
      onClick={onCreate}
      className="orders-header-create"
      id="order_add_btn"
      aria-label="Créer une nouvelle commande"
    >
      <Plus size={16} />
      <span className="orders-header-create-label">Nouvelle commande</span>
    </button>
  </div>
);

export default OrdersHeader;