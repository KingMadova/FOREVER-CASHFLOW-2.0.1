import React, { useMemo, useState } from 'react';
import { Download, Search, Receipt, Wallet, TrendingUp, CircleDollarSign, ChevronRight } from 'lucide-react';
import { useOrdersStore } from '../store/slices/ordersSlice';
import { isCountedOrder, orderAccountingDate } from '../lib/orderStats';
import './SalesView.css';

type Period = '7' | '30' | '90' | 'year';

const money = (value: number) => `${Math.round(value || 0).toLocaleString('fr-FR')} FCFA`;
const shortMoney = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.', ',')} M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)} k`;
  return String(Math.round(value));
};
const dateLabel = (value: string) => {
  if (!value) return '—';
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(date);
};
const paymentLabel: Record<string, string> = {
  ESPECES: 'Espèces', AIRTEL: 'Airtel Money', MTN: 'MTN MoMo', VIREMENT: 'Virement', MIXTE: 'Mixte', AUTRE: 'Autre'
};

export const SalesView: React.FC = () => {
  const orders = useOrdersStore(state => state.orders);
  const [period, setPeriod] = useState<Period>('30');
  const [query, setQuery] = useState('');

  const countedOrders = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    if (period === 'year') start.setMonth(0, 1);
    else start.setDate(now.getDate() - Number(period) + 1);
    const startKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    const endKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return orders.filter(order => {
      const date = orderAccountingDate(order);
      return isCountedOrder(order) && date >= startKey && date <= endKey;
    }).sort((a, b) => orderAccountingDate(b).localeCompare(orderAccountingDate(a)));
  }, [orders, period]);

  const visibleOrders = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('fr-FR');
    if (!term) return countedOrders;
    return countedOrders.filter(order =>
      [order.refCommande, order.customerName, order.paiement, ...(order.items || []).map(item => item.productName)]
        .filter(Boolean).join(' ').toLocaleLowerCase('fr-FR').includes(term)
    );
  }, [countedOrders, query]);

  const totals = useMemo(() => countedOrders.reduce((acc, order) => {
    const paid = Math.min(order.totalRetail, Math.max(0, order.amountPaid ?? order.totalRetail));
    acc.revenue += order.totalRetail;
    acc.paid += paid;
    acc.count += 1;
    return acc;
  }, { revenue: 0, paid: 0, margin: 0, count: 0 }), [countedOrders]);

  const daily = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      return { key, label: new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(date), amount: 0 };
    });
    countedOrders.forEach(order => {
      const day = days.find(item => item.key === orderAccountingDate(order));
      if (day) day.amount += order.totalRetail;
    });
    return days;
  }, [countedOrders]);

  const paymentMix = useMemo(() => {
    const map = new Map<string, number>();
    countedOrders.forEach(order => map.set(order.paiement, (map.get(order.paiement) || 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [countedOrders]);

  const exportCsv = () => {
    const rows = [
      ['Date', 'Référence', 'Client', 'Mode de paiement', 'CA (FCFA)', 'Encaissé (FCFA)', 'Marge (FCFA)', 'Statut'],
      ...visibleOrders.map(order => [
        orderAccountingDate(order), order.refCommande || order.id, order.customerName,
        paymentLabel[order.paiement] || order.paiement,
        order.totalRetail, order.amountPaid ?? order.totalRetail, order.totalMargin, order.status
      ])
    ];
    const csv = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'forever-cashflow-ventes.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const maxDaily = Math.max(1, ...daily.map(day => day.amount));

  return (
    <section id="sales_view_container" className="sales-view">
      <header className="sales-header">
        <div>
          <div className="sales-eyebrow">PILOTAGE COMMERCIAL</div>
          <h1>Ventes</h1>
          <p>Suivez le chiffre d'affaires des commandes validées et les montants déclarés encaissés.</p>
        </div>
        <div className="sales-header-actions">
          <div className="sales-period-control" role="group" aria-label="Période">
            {([
              ['7', '7 jours'], ['30', '30 jours'], ['90', '90 jours'], ['year', 'Année']
            ] as [Period, string][]).map(([value, label]) => (
              <button key={value} type="button" className={period === value ? 'is-active' : ''} onClick={() => setPeriod(value)}>{label}</button>
            ))}
          </div>
          <button type="button" className="sales-export-button" onClick={exportCsv}><Download size={16} /> Exporter</button>
        </div>
      </header>

      <div className="sales-kpi-grid">
        <article className="sales-kpi sales-kpi-primary">
          <span>Chiffre d'affaires</span>
          <strong>{money(totals.revenue)}</strong>
          <small>{totals.count} commande{totals.count > 1 ? 's' : ''} comptabilisée{totals.count > 1 ? 's' : ''}</small>
          <Receipt size={18} aria-hidden="true" />
        </article>
        <article className="sales-kpi">
          <span>Montant encaissé déclaré</span>
          <strong>{money(totals.paid)}</strong>
          <small>Selon le champ « montant perçu » des commandes</small>
          <Wallet size={18} aria-hidden="true" />
        </article>
        <article className="sales-kpi">
          <span>Écart catalogue / encaissé</span>
          <strong>{money(Math.max(0, totals.revenue - totals.paid))}</strong>
          <small>Écart de valeur, pas un solde client dû</small>
          <CircleDollarSign size={18} aria-hidden="true" />
        </article>
        <article className="sales-kpi">
          <span>Panier moyen catalogue</span>
          <strong>{money(totals.count ? totals.revenue / totals.count : 0)}</strong>
          <small>Valeur catalogue moyenne par commande</small>
          <TrendingUp size={18} aria-hidden="true" />
        </article>
      </div>

      <div className="sales-main-grid">
        <section className="sales-list-panel">
          <div className="sales-panel-heading">
            <div><h2>Commandes comptabilisées</h2><span>{visibleOrders.length} résultat{visibleOrders.length > 1 ? 's' : ''}</span></div>
            <label className="sales-search"><Search size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher client, référence…" /></label>
          </div>
          <div className="sales-table-wrap">
            <table className="sales-table">
              <thead><tr><th>Date</th><th>Référence / Client</th><th>Paiement</th><th className="numeric">CA</th><th className="numeric">Encaissé</th><th>Statut</th></tr></thead>
              <tbody>
                {visibleOrders.map(order => {
                  const paid = Math.min(order.totalRetail, Math.max(0, order.amountPaid ?? order.totalRetail));
                  return (
                    <tr key={order.id}>
                      <td className="sales-date">{dateLabel(orderAccountingDate(order))}</td>
                      <td><div className="sales-order-identity"><strong>{order.refCommande || order.id}</strong><span>{order.customerName}</span></div></td>
                      <td><span className="sales-payment">{paymentLabel[order.paiement] || order.paiement}</span></td>
                      <td className="numeric sales-amount">{money(order.totalRetail)}</td>
                      <td className="numeric sales-paid">{money(paid)}</td>
                      <td><span className={`sales-status sales-status-${order.status.toLowerCase()}`}>{order.status === 'PAYE' ? 'Payée' : 'Validée'}</span></td>
                    </tr>
                  );
                })}
                {visibleOrders.length === 0 && <tr><td colSpan={6} className="sales-empty">{query ? 'Aucun résultat pour cette recherche.' : 'Aucune commande comptabilisée sur cette période.'}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="sales-analysis">
          <section className="sales-analysis-card">
            <div className="sales-analysis-title"><div><h2>Activité récente</h2><span>CA catalogue · 7 jours</span></div><ChevronRight size={16} /></div>
            <div className="sales-bars" role="img" aria-label="Chiffre d'affaires par jour sur les sept derniers jours">
              {daily.map(day => (
                <div className="sales-bar-column" key={day.key} title={`${day.label} : ${money(day.amount)}`}>
                  <strong>{day.amount ? shortMoney(day.amount) : '—'}</strong>
                  <div className="sales-bar-track"><span style={{ height: `${Math.max(day.amount > 0 ? 8 : 0, (day.amount / maxDaily) * 100)}%` }} /></div>
                  <small>{day.label}</small>
                </div>
              ))}
            </div>
          </section>
          <section className="sales-analysis-card">
            <div className="sales-analysis-title"><div><h2>Modes de paiement</h2><span>Nombre de commandes par mode</span></div></div>
            {paymentMix.length ? paymentMix.map(([mode, count]) => (
              <div className="sales-payment-row" key={mode}>
                <div><span>{paymentLabel[mode] || mode}</span><strong>{count}</strong></div>
                <div className="sales-payment-track"><span style={{ width: `${(count / totals.count) * 100}%` }} /></div>
              </div>
            )) : <p className="sales-analysis-empty">Les répartitions apparaîtront avec les commandes validées.</p>}
          </section>
          <div className="sales-data-note">Cette vue est calculée à partir des commandes existantes. Elle ne constitue pas encore un journal indépendant des encaissements.</div>
        </aside>
      </div>
    </section>
  );
};

export default SalesView;
