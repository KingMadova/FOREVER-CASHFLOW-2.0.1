import React, { useMemo, useState } from 'react';
import {
  Download,
  Search,
  Receipt,
  Wallet,
  TrendingUp,
  ShoppingBag,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  MousePointerClick,
} from 'lucide-react';
import { useOrdersStore } from '../store/slices/ordersSlice';
import { isCountedOrder, orderAccountingDate } from '../lib/orderStats';
import { Order } from '../types';
import { SalesDetailSheet, type SalesDetailSummary } from '../components/ui/sales/SalesDetailSheet';
import './SalesView.css';

type Period = '7' | '30' | 'month' | '90' | 'year';

const money = (value: number) =>
  `${Math.round(value || 0).toLocaleString('fr-FR').replace(/\u202f/g, ' ')} FCFA`;

const dateLabel = (value: string) => {
  if (!value) return '—';
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(date);
};

const paymentLabel: Record<string, string> = {
  ESPECES: 'Espèces',
  AIRTEL: 'Airtel Money',
  MTN: 'MTN MoMo',
  VIREMENT: 'Virement',
  MIXTE: 'Mixte',
  AUTRE: 'Autre',
};

const dateKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const getPeriodRange = (period: Period): { start: Date; end: Date } => {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  switch (period) {
    case '7':
      start.setDate(start.getDate() - 6);
      break;
    case '30':
      start.setDate(start.getDate() - 29);
      break;
    case 'month':
      start.setDate(1);
      break;
    case '90':
      start.setDate(start.getDate() - 89);
      break;
    case 'year':
      start.setMonth(0, 1);
      break;
  }
  return { start, end };
};

const getPreviousRange = (period: Period): { start: Date; end: Date } => {
  const { start } = getPeriodRange(period);
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  prevEnd.setHours(23, 59, 59, 999);
  const prevStart = new Date(prevEnd);
  prevStart.setHours(0, 0, 0, 0);
  switch (period) {
    case '7':
      prevStart.setDate(prevStart.getDate() - 6);
      break;
    case '30':
      prevStart.setDate(prevStart.getDate() - 29);
      break;
    case 'month':
      prevStart.setDate(1);
      break;
    case '90':
      prevStart.setDate(prevStart.getDate() - 89);
      break;
    case 'year':
      prevStart.setMonth(0, 1);
      break;
  }
  return { start: prevStart, end: prevEnd };
};

const vsLabelFor = (period: Period): string => {
  switch (period) {
    case '7': return 'vs 7 jours avant';
    case '30': return 'vs 30 jours avant';
    case 'month': return 'vs mois précédent';
    case '90': return 'vs 90 jours avant';
    case 'year': return 'vs année précédente';
  }
};

interface Totals { revenue: number; paid: number; count: number; avg: number }

const sumOrders = (list: Order[]): Totals => {
  let revenue = 0, paid = 0, count = 0;
  for (const o of list) {
    revenue += o.totalRetail;
    paid += Math.min(o.totalRetail, Math.max(0, o.amountPaid ?? o.totalRetail));
    count += 1;
  }
  return { revenue, paid, count, avg: count > 0 ? revenue / count : 0 };
};

const computeDelta = (cur: number, prev: number) => {
  const diff = cur - prev;
  if (prev === 0) return { diff, pct: cur === 0 ? 0 : 100 };
  return { diff, pct: (diff / prev) * 100 };
};

const formatDeltaAmount = (n: number) => {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${Math.abs(Math.round(n)).toLocaleString('fr-FR').replace(/\u202f/g, ' ')} FCFA`;
};

const formatDeltaCount = (n: number) => {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${Math.abs(Math.round(n)).toLocaleString('fr-FR')}`;
};

type KpiTone = 'gold' | 'emerald' | 'blue' | 'violet';

interface KpiCardProps {
  label: string;
  value: string;
  deltaLabel: string;
  deltaPct: number;
  vsLabel: string;
  icon: React.ReactNode;
  tone: KpiTone;
  onClick?: () => void;
}

const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  deltaLabel,
  deltaPct,
  vsLabel,
  icon,
  tone,
  onClick,
}) => {
  const isUp = deltaPct > 0;
  const isDown = deltaPct < 0;
  const trendClass = isUp ? 'is-positive' : isDown ? 'is-negative' : 'is-neutral';
  const ariaTrend = isUp
    ? `En hausse de ${Math.abs(deltaPct).toFixed(1)} pour cent`
    : isDown
      ? `En baisse de ${Math.abs(deltaPct).toFixed(1)} pour cent`
      : 'Stable';
  const Tag = onClick ? 'button' : 'article';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`sales-kpi-card ${onClick ? 'is-clickable' : ''}`}
      aria-label={onClick ? `${label} — voir le détail` : undefined}
    >
      <header className="sales-kpi-header">
        <span className="sales-kpi-label">{label}</span>
        <span className={`sales-kpi-icon is-${tone}`} aria-hidden="true">{icon}</span>
      </header>
      <p className="sales-kpi-value">{value}</p>
      <p className="sales-kpi-delta-line">
        <span className={`sales-kpi-delta ${trendClass}`}>{deltaLabel}</span>
        <span className="sales-kpi-vs">{vsLabel}</span>
      </p>
      <span className={`sales-kpi-badge ${trendClass}`} aria-label={ariaTrend}>
        {isUp ? <ArrowUpRight size={11} /> : isDown ? <ArrowDownRight size={11} /> : null}
        {Math.abs(deltaPct).toFixed(1)} %
      </span>
      {onClick && (
        <span className="sales-kpi-hint" aria-hidden="true">
          <MousePointerClick size={11} />
        </span>
      )}
    </Tag>
  );
};

type DetailKind = 'revenue' | 'paid' | 'count' | 'avg' | 'day' | 'payment' | 'ecart';

interface DetailState {
  kind: DetailKind;
  title: string;
  subtitle?: string;
  summary: SalesDetailSummary[];
  orders: Order[];
}

export const SalesView: React.FC = () => {
  const orders = useOrdersStore((state) => state.orders);
  const [period, setPeriod] = useState<Period>('30');
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<DetailState | null>(null);

  const currentRange = useMemo(() => getPeriodRange(period), [period]);
  const previousRange = useMemo(() => getPreviousRange(period), [period]);
  const currentStartKey = dateKey(currentRange.start);
  const currentEndKey = dateKey(currentRange.end);
  const previousStartKey = dateKey(previousRange.start);
  const previousEndKey = dateKey(previousRange.end);
  const vsLabel = vsLabelFor(period);

  const countedOrders = useMemo(
    () =>
      orders
        .filter((order) => {
          const d = orderAccountingDate(order);
          return isCountedOrder(order) && d >= currentStartKey && d <= currentEndKey;
        })
        .sort((a, b) => orderAccountingDate(b).localeCompare(orderAccountingDate(a))),
    [orders, currentStartKey, currentEndKey],
  );

  const previousOrders = useMemo(
    () =>
      orders.filter((order) => {
        const d = orderAccountingDate(order);
        return isCountedOrder(order) && d >= previousStartKey && d <= previousEndKey;
      }),
    [orders, previousStartKey, previousEndKey],
  );

  const totals = useMemo(() => sumOrders(countedOrders), [countedOrders]);
  const previousTotals = useMemo(() => sumOrders(previousOrders), [previousOrders]);

  const visibleOrders = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('fr-FR');
    if (!term) return countedOrders;
    return countedOrders.filter((order) =>
      [order.refCommande, order.customerName, order.paiement, ...(order.items || []).map((i) => i.productName)]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('fr-FR')
        .includes(term),
    );
  }, [countedOrders, query]);

  const daily = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const key = dateKey(date);
      return {
        key,
        label: new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(date),
        longLabel: new Intl.DateTimeFormat('fr-FR', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        }).format(date),
        amount: 0,
      };
    });
    countedOrders.forEach((order) => {
      const day = days.find((item) => item.key === orderAccountingDate(order));
      if (day) day.amount += order.totalRetail;
    });
    return days;
  }, [countedOrders]);

  const paymentMix = useMemo(() => {
    const map = new Map<string, number>();
    countedOrders.forEach((order) => map.set(order.paiement, (map.get(order.paiement) || 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [countedOrders]);

  const exportCsv = () => {
    const rows = [
      ['Date', 'Référence', 'Client', 'Mode de paiement', 'Chiffre d\'affaires (FCFA)', 'Encaissé (FCFA)', 'Marge (FCFA)', 'Statut'],
      ...visibleOrders.map((order) => [
        orderAccountingDate(order),
        order.refCommande || order.id,
        order.customerName,
        paymentLabel[order.paiement] || order.paiement,
        order.totalRetail,
        order.amountPaid ?? order.totalRetail,
        order.totalMargin,
        order.status,
      ]),
    ];
    const csv = rows
      .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'forever-cashflow-ventes.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const maxDaily = Math.max(1, ...daily.map((day) => day.amount));
  const ecart = Math.max(0, totals.revenue - totals.paid);
  const ecartPrev = Math.max(0, previousTotals.revenue - previousTotals.paid);

  const deltaRevenue = computeDelta(totals.revenue, previousTotals.revenue);
  const deltaPaid = computeDelta(totals.paid, previousTotals.paid);
  const deltaCount = computeDelta(totals.count, previousTotals.count);
  const deltaAvg = computeDelta(totals.avg, previousTotals.avg);

  /* --- Handlers d'ouverture des détails --- */
  const openRevenue = () => {
    setDetail({
      kind: 'revenue',
      title: 'Chiffre d\'affaires',
      subtitle: `Détail des ${countedOrders.length} commandes comptabilisées sur la période sélectionnée.`,
      summary: [
        { label: 'Total', value: money(totals.revenue) },
        { label: 'Commandes', value: String(totals.count) },
      ],
      orders: countedOrders,
    });
  };

  const openPaid = () => {
    setDetail({
      kind: 'paid',
      title: 'Montants encaissés déclarés',
      subtitle: 'Commandes comptabilisées et montant perçu enregistré (colonne « encaissé »).',
      summary: [
        { label: 'Encaissé', value: money(totals.paid) },
        { label: 'Catalogue', value: money(totals.revenue) },
      ],
      orders: countedOrders,
    });
  };

  const openCount = () => {
    setDetail({
      kind: 'count',
      title: 'Commandes comptabilisées',
      subtitle: 'Toutes les commandes validées ou payées sur la période.',
      summary: [{ label: 'Commandes', value: String(totals.count) }],
      orders: countedOrders,
    });
  };

  const openAvg = () => {
    setDetail({
      kind: 'avg',
      title: 'Panier moyen catalogue',
      subtitle: 'Commandes triées par montant décroissant.',
      summary: [
        { label: 'Panier moyen', value: money(totals.avg) },
        { label: 'Commandes', value: String(totals.count) },
      ],
      orders: [...countedOrders].sort((a, b) => b.totalRetail - a.totalRetail),
    });
  };

  const openDay = (dayKey: string, dayLongLabel: string, amount: number) => {
    const dayOrders = countedOrders.filter(
      (o) => orderAccountingDate(o) === dayKey,
    );
    setDetail({
      kind: 'day',
      title: dayLongLabel,
      subtitle: 'Commandes comptabilisées sur cette journée.',
      summary: [
        { label: 'Chiffre d\'affaires', value: money(amount) },
        { label: 'Commandes', value: String(dayOrders.length) },
      ],
      orders: dayOrders,
    });
  };

  const openPayment = (mode: string, count: number) => {
    const modeOrders = countedOrders.filter((o) => o.paiement === mode);
    setDetail({
      kind: 'payment',
      title: `Paiements ${paymentLabel[mode] || mode}`,
      subtitle: 'Commandes comptabilisées réglées par ce mode.',
      summary: [
        { label: 'Commandes', value: String(count) },
        { label: 'Chiffre d\'affaires', value: money(modeOrders.reduce((s, o) => s + o.totalRetail, 0)) },
      ],
      orders: modeOrders,
    });
  };

  const openEcart = () => {
    const ecartOrders = countedOrders.filter((o) => {
      const paid = Math.min(o.totalRetail, Math.max(0, o.amountPaid ?? o.totalRetail));
      return paid !== o.totalRetail;
    });
    setDetail({
      kind: 'ecart',
      title: 'Écart catalogue / encaissé',
      subtitle: 'Commandes où le montant déclaré encaissé diffère du catalogue. Écart de valeur, pas un solde dû.',
      summary: [
        { label: 'Écart total', value: money(ecart) },
        { label: 'Commandes concernées', value: String(ecartOrders.length) },
      ],
      orders: ecartOrders,
    });
  };

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
            {(
              [
                ['7', '7 jours'],
                ['30', '30 jours'],
                ['month', 'Ce mois'],
                ['90', '90 jours'],
                ['year', 'Cette année'],
              ] as [Period, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={period === value ? 'is-active' : ''}
                onClick={() => setPeriod(value)}
                aria-pressed={period === value}
              >
                {label}
              </button>
            ))}
          </div>
          <button type="button" className="sales-export-button" onClick={exportCsv}>
            <Download size={14} />
            <span className="sales-export-label">Exporter</span>
          </button>
        </div>
      </header>

      <div className="sales-kpi-grid">
        <KpiCard
          label="Chiffre d'affaires"
          value={money(totals.revenue)}
          deltaLabel={formatDeltaAmount(deltaRevenue.diff)}
          deltaPct={deltaRevenue.pct}
          vsLabel={vsLabel}
          icon={<Receipt size={16} />}
          tone="gold"
          onClick={openRevenue}
        />
        <KpiCard
          label="Encaissé déclaré"
          value={money(totals.paid)}
          deltaLabel={formatDeltaAmount(deltaPaid.diff)}
          deltaPct={deltaPaid.pct}
          vsLabel={vsLabel}
          icon={<Wallet size={16} />}
          tone="emerald"
          onClick={openPaid}
        />
        <KpiCard
          label="Commandes"
          value={formatDeltaCount(totals.count).replace('+', '').replace('−', '')}
          deltaLabel={formatDeltaCount(deltaCount.diff)}
          deltaPct={deltaCount.pct}
          vsLabel={vsLabel}
          icon={<ShoppingBag size={16} />}
          tone="blue"
          onClick={openCount}
        />
        <KpiCard
          label="Panier moyen"
          value={money(totals.avg)}
          deltaLabel={formatDeltaAmount(deltaAvg.diff)}
          deltaPct={deltaAvg.pct}
          vsLabel={vsLabel}
          icon={<TrendingUp size={16} />}
          tone="violet"
          onClick={openAvg}
        />
      </div>

      <button
        type="button"
        className="sales-ecart-strip is-clickable"
        onClick={openEcart}
        aria-label="Voir le détail des commandes avec écart catalogue/encaissé"
      >
        <div>
          <span>Écart catalogue / encaissé</span>
          <strong>{money(ecart)}</strong>
        </div>
        <small>Écart de valeur, pas un solde client dû · période précédente : {money(ecartPrev)}</small>
      </button>

      <div className="sales-main-grid">
        <section className="sales-list-panel">
          <div className="sales-panel-heading">
            <div>
              <h2>Commandes comptabilisées</h2>
              <span>
                {visibleOrders.length} résultat{visibleOrders.length > 1 ? 's' : ''}
              </span>
            </div>
            <label className="sales-search">
              <Search size={14} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher client, référence…"
                aria-label="Rechercher une commande comptabilisée"
              />
            </label>
          </div>

          <div className="sales-table-wrap">
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Référence / Client</th>
                  <th>Paiement</th>
                  <th className="numeric">Chiffre d'affaires</th>
                  <th className="numeric">Encaissé</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {visibleOrders.map((order) => {
                  const paid = Math.min(order.totalRetail, Math.max(0, order.amountPaid ?? order.totalRetail));
                  return (
                    <tr key={order.id}>
                      <td className="sales-date">{dateLabel(orderAccountingDate(order))}</td>
                      <td>
                        <div className="sales-order-identity">
                          <strong>{order.refCommande || order.id}</strong>
                          <span>{order.customerName}</span>
                        </div>
                      </td>
                      <td>
                        <span className="sales-payment">{paymentLabel[order.paiement] || order.paiement}</span>
                      </td>
                      <td className="numeric sales-amount">{money(order.totalRetail)}</td>
                      <td className="numeric sales-paid">{money(paid)}</td>
                      <td>
                        <span className={`sales-status sales-status-${order.status.toLowerCase()}`}>
                          {order.status === 'PAYE' ? 'Payée' : 'Validée'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {visibleOrders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="sales-empty">
                      {query ? 'Aucun résultat pour cette recherche.' : 'Aucune commande comptabilisée sur cette période.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="sales-cards-wrap">
            {visibleOrders.length === 0 ? (
              <div className="sales-empty-card">
                {query ? 'Aucun résultat pour cette recherche.' : 'Aucune commande comptabilisée sur cette période.'}
              </div>
            ) : (
              visibleOrders.map((order) => {
                const paid = Math.min(order.totalRetail, Math.max(0, order.amountPaid ?? order.totalRetail));
                const showPaid = paid !== order.totalRetail;
                return (
                  <div key={order.id} className="sales-card">
                    <div className={`sales-card-icon is-${order.status.toLowerCase()}`}>
                      <Receipt size={15} />
                    </div>
                    <div className="sales-card-main">
                      <strong>{order.customerName}</strong>
                      <span>
                        {order.refCommande || order.id} · {dateLabel(orderAccountingDate(order))}
                      </span>
                      <span>{paymentLabel[order.paiement] || order.paiement}</span>
                    </div>
                    <div className="sales-card-trailing">
                      <strong>{money(order.totalRetail)}</strong>
                      {showPaid && <span className="sales-paid">Encaissé {money(paid)}</span>}
                      <span className={`sales-status sales-status-${order.status.toLowerCase()}`}>
                        {order.status === 'PAYE' ? 'Payée' : 'Validée'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <aside className="sales-analysis">
          <section className="sales-analysis-card">
            <div className="sales-analysis-title">
              <div>
                <h2>Activité récente</h2>
                <span>Chiffre d'affaires · 7 derniers jours</span>
              </div>
              <ChevronRight size={15} />
            </div>
            <div className="sales-bars" role="group" aria-label="Chiffre d'affaires par jour sur les sept derniers jours">
              {daily.map((day) => (
                <button
                  key={day.key}
                  type="button"
                  className="sales-bar-column is-clickable"
                  onClick={() => openDay(day.key, day.longLabel, day.amount)}
                  title={`${day.longLabel} — ${money(day.amount)}`}
                  aria-label={`Voir les commandes du ${day.longLabel} — ${money(day.amount)}`}
                >
                  <strong>{day.amount ? money(day.amount).replace(' FCFA', '') : '—'}</strong>
                  <div className="sales-bar-track">
                    <span style={{ height: `${Math.max(day.amount > 0 ? 8 : 0, (day.amount / maxDaily) * 100)}%` }} />
                  </div>
                  <small>{day.label}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="sales-analysis-card">
            <div className="sales-analysis-title">
              <div>
                <h2>Modes de paiement</h2>
                <span>Nombre de commandes par mode</span>
              </div>
            </div>
            {paymentMix.length ? (
              paymentMix.map(([mode, count]) => (
                <button
                  key={mode}
                  type="button"
                  className="sales-payment-row is-clickable"
                  onClick={() => openPayment(mode, count)}
                  aria-label={`Voir les ${count} commandes réglées en ${paymentLabel[mode] || mode}`}
                >
                  <div>
                    <span>{paymentLabel[mode] || mode}</span>
                    <strong>{count}</strong>
                  </div>
                  <div className="sales-payment-track">
                    <span style={{ width: `${(count / Math.max(1, totals.count)) * 100}%` }} />
                  </div>
                </button>
              ))
            ) : (
              <p className="sales-analysis-empty">Les répartitions apparaîtront avec les commandes validées.</p>
            )}
          </section>

          <div className="sales-data-note">
            Cette vue est calculée à partir des commandes existantes. Elle ne constitue pas encore un
            journal indépendant des encaissements.
          </div>
        </aside>
      </div>

      <SalesDetailSheet
        isOpen={detail !== null}
        onClose={() => setDetail(null)}
        title={detail?.title ?? ''}
        subtitle={detail?.subtitle}
        summary={detail?.summary ?? []}
        orders={detail?.orders ?? []}
      />
    </section>
  );
};

export default SalesView;