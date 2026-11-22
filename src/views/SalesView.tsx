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
  ArrowDown,
  ArrowUp,
  Award,
  Package,
} from 'lucide-react';
import { useOrdersStore } from '../store/slices/ordersSlice';
import { useCustomersStore } from '../store/slices/customersSlice';
import { isCountedOrder, orderAccountingDate } from '../lib/orderStats';
import { Order } from '../types';
import { SalesDetailSheet, type SalesDetailSummary } from '../components/ui/sales/SalesDetailSheet';
import { SalesExportDialog } from '../components/ui/sales/SalesExportDialog';
import { formatDecimal, formatMoney, formatNumber, formatSignedMoney } from '../lib/format';
import {
  buildSalesCsvExport,
  computeProductPerformance,
  computeSalesNetSummary,
  inspectOrderNetAmount,
  type ProductPerformanceRow,
  type ProductSortBy,
  type SalesExportMode,
  type SortDirection,
} from '../lib/salesReports';
import { useActionFeedback } from '../hooks/useActionFeedback';
import './SalesView.css';

type Period = '7' | '30' | 'month' | '90' | 'year';

const money = (value: number) => formatMoney(value);

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

const computeDelta = (cur: number, prev: number) => {
  const diff = cur - prev;
  if (prev === 0) return { diff, pct: cur === 0 ? 0 : 100 };
  return { diff, pct: (diff / prev) * 100 };
};

const formatDeltaAmount = (n: number) => formatSignedMoney(n);

const formatDeltaCount = (n: number) => {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${formatNumber(Math.abs(n))}`;
};

type KpiTone = 'gold' | 'emerald' | 'blue' | 'violet';

interface KpiCardProps {
  label: string;
  value: string;
  deltaLabel: string;
  deltaPct: number | null;
  vsLabel: string;
  metaText?: string;
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
  metaText,
  icon,
  tone,
  onClick,
}) => {
  const isUp = deltaPct !== null && deltaPct > 0;
  const isDown = deltaPct !== null && deltaPct < 0;
  const trendClass = isUp ? 'is-positive' : isDown ? 'is-negative' : 'is-neutral';
  const ariaTrend =
    deltaPct === null
      ? 'Données insuffisantes pour la comparaison'
      : isUp
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
      {metaText && <p className="sales-kpi-vs">{metaText}</p>}
      <span className={`sales-kpi-badge ${trendClass}`} aria-label={ariaTrend}>
        {isUp ? <ArrowUpRight size={11} /> : isDown ? <ArrowDownRight size={11} /> : null}
        {deltaPct !== null ? `${Math.abs(deltaPct).toFixed(1)} %` : '—'}
      </span>
      {onClick && (
        <span className="sales-kpi-hint" aria-hidden="true">
          <MousePointerClick size={11} />
        </span>
      )}
    </Tag>
  );
};

type DetailKind = 'revenue' | 'paid' | 'count' | 'avg' | 'day' | 'payment' | 'ecart' | 'product';

interface DetailState {
  kind: DetailKind;
  title: string;
  subtitle?: string;
  summary: SalesDetailSummary[];
  orders: Order[];
  highlightProductKey?: string;
}

const periodLabelFor = (period: Period): string => {
  switch (period) {
    case '7': return '7 derniers jours';
    case '30': return '30 derniers jours';
    case 'month': return 'Ce mois';
    case '90': return '90 derniers jours';
    case 'year': return 'Cette année';
  }
};

export const SalesView: React.FC = () => {
  const orders = useOrdersStore((state) => state.orders);
  const customers = useCustomersStore((state) => state.customers);
  const { notifySuccess } = useActionFeedback();
  const [period, setPeriod] = useState<Period>('30');
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [productSortBy, setProductSortBy] = useState<ProductSortBy>('revenue');
  const [productSortDir, setProductSortDir] = useState<SortDirection>('desc');
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

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

  const netSummary = useMemo(() => computeSalesNetSummary(countedOrders), [countedOrders]);
  const prevNetSummary = useMemo(() => computeSalesNetSummary(previousOrders), [previousOrders]);
  const totals = useMemo(
    () => ({
      revenue: netSummary.totalCatalogRevenue,
      count: netSummary.totalOrdersCount,
      avg: netSummary.totalOrdersCount > 0 ? netSummary.totalCatalogRevenue / netSummary.totalOrdersCount : 0,
    }),
    [netSummary],
  );
  const previousTotals = useMemo(
    () => ({
      revenue: prevNetSummary.totalCatalogRevenue,
      count: prevNetSummary.totalOrdersCount,
      avg: prevNetSummary.totalOrdersCount > 0 ? prevNetSummary.totalCatalogRevenue / prevNetSummary.totalOrdersCount : 0,
    }),
    [prevNetSummary],
  );

  const productSummary = useMemo(
    () =>
      computeProductPerformance(countedOrders, {
        sortBy: productSortBy,
        sortDir: productSortDir,
      }),
    [countedOrders, productSortBy, productSortDir],
  );

  const customersById = useMemo(() => {
    const map = new Map<string, (typeof customers)[number]>();
    for (const c of customers) {
      map.set(c.id, c);
    }
    return map;
  }, [customers]);

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

  const handlePerformExport = (mode: SalesExportMode) => {
    const result = buildSalesCsvExport(visibleOrders, {
      mode,
      customersById,
      paymentLabels: paymentLabel,
    });
    const blob = new Blob(['\uFEFF', result.csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `forever-cashflow-ventes-${mode}-${dateKey(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setIsExportDialogOpen(false);
    notifySuccess(
      mode === 'anonymise'
        ? `Export anonymisé téléchargé (${result.orderCount} commande${result.orderCount > 1 ? 's' : ''}) !`
        : `Export nominatif téléchargé (${result.orderCount} commande${result.orderCount > 1 ? 's' : ''}) !`,
    );
  };

  const toggleProductSort = (nextBy: ProductSortBy) => {
    if (productSortBy === nextBy) {
      setProductSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setProductSortBy(nextBy);
      setProductSortDir('desc');
    }
  };

  const maxDaily = Math.max(1, ...daily.map((day) => day.amount));
  const netCoverageParts = [
    `${netSummary.validAmountOrdersCount} valide${netSummary.validAmountOrdersCount > 1 ? 's' : ''}`,
    ...(netSummary.missingAmountOrdersCount > 0
      ? [`${netSummary.missingAmountOrdersCount} sans montant`]
      : []),
    ...(netSummary.invalidAmountOrdersCount > 0
      ? [`${netSummary.invalidAmountOrdersCount} invalide${netSummary.invalidAmountOrdersCount > 1 ? 's' : ''}`]
      : []),
  ];
  const netCoverageSummary =
    netSummary.totalOrdersCount > 0 ? netCoverageParts.join(' · ') : 'Aucune commande sur la période';

  const deltaRevenue = computeDelta(totals.revenue, previousTotals.revenue);
  const deltaNetRecorded =
    netSummary.netRecordedTotal !== null && prevNetSummary.netRecordedTotal !== null
      ? computeDelta(netSummary.netRecordedTotal, prevNetSummary.netRecordedTotal)
      : { diff: null as number | null, pct: null as number | null };
  const deltaCount = computeDelta(totals.count, previousTotals.count);
  const deltaAvg = computeDelta(totals.avg, previousTotals.avg);

  /* --- Handlers d'ouverture des détails --- */
  const openRevenue = () => {
    setDetail({
      kind: 'revenue',
      title: 'Chiffre d\'affaires catalogue',
      subtitle: `Détail des ${countedOrders.length} commandes comptabilisées sur la période sélectionnée.`,
      summary: [
        { label: 'Total catalogue', value: money(totals.revenue) },
        { label: 'Commandes', value: String(totals.count) },
      ],
      orders: countedOrders,
    });
  };

  const openNetRecorded = () => {
    setDetail({
      kind: 'paid',
      title: 'Montant net enregistré sur les bons',
      subtitle:
        'Le montant net enregistré correspond à la valeur inscrite sur le bon de commande. Il ne constitue pas une preuve de paiement réellement reçu.',
      summary: [
        {
          label: 'Montant net enregistré',
          value:
            netSummary.netRecordedTotal !== null
              ? money(netSummary.netRecordedTotal)
              : 'Données insuffisantes',
        },
        { label: 'Catalogue (périmètre valide)', value: money(netSummary.coveredCatalogRevenue) },
        {
          label: 'Écart (catalogue − net)',
          value:
            netSummary.orderLevelGap !== null
              ? formatSignedMoney(netSummary.orderLevelGap)
              : 'Données insuffisantes',
        },
        { label: 'Cmd avec montant valide', value: String(netSummary.validAmountOrdersCount) },
        { label: 'Cmd sans montant', value: String(netSummary.missingAmountOrdersCount) },
        { label: 'Cmd montant invalide', value: String(netSummary.invalidAmountOrdersCount) },
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
      subtitle: 'Commandes triées par valeur catalogue décroissante.',
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
        { label: 'Chiffre d\'affaires catalogue', value: money(amount) },
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
      subtitle: 'Commandes comptabilisées enregistrées avec ce mode de paiement.',
      summary: [
        { label: 'Commandes', value: String(count) },
        { label: 'Valeur catalogue', value: money(modeOrders.reduce((s, o) => s + o.totalRetail, 0)) },
      ],
      orders: modeOrders,
    });
  };

  const openEcart = () => {
    const ecartOrders = countedOrders.filter((o) => {
      const inspected = inspectOrderNetAmount(o);
      if (inspected.status !== 'VALID' || inspected.amount === null) return true;
      return inspected.amount !== o.totalRetail;
    });
    setDetail({
      kind: 'ecart',
      title: 'Écart valeur catalogue / montant net enregistré',
      subtitle:
        'L\'écart peut correspondre à une remise comme à un supplément (notamment des frais de livraison). Les commandes sans montant ou avec montant invalide sont exclues du calcul et listées pour vérification.',
      summary: [
        {
          label: 'Écart (périmètre valide)',
          value:
            netSummary.orderLevelGap !== null
              ? formatSignedMoney(netSummary.orderLevelGap)
              : 'Données insuffisantes',
        },
        { label: 'Catalogue (périmètre valide)', value: money(netSummary.coveredCatalogRevenue) },
        {
          label: 'Montant net enregistré',
          value:
            netSummary.netRecordedTotal !== null
              ? money(netSummary.netRecordedTotal)
              : 'Données insuffisantes',
        },
        { label: 'Cmd valides / sans / invalides', value: `${netSummary.validAmountOrdersCount} / ${netSummary.missingAmountOrdersCount} / ${netSummary.invalidAmountOrdersCount}` },
      ],
      orders: ecartOrders,
    });
  };

  const openProductDetail = (row: ProductPerformanceRow) => {
    const orderSet = new Set(row.orderIds);
    const matchingOrders = countedOrders.filter((o) => orderSet.has(o.id));
    setDetail({
      kind: 'product',
      title: row.productName,
      subtitle: `Commandes comptabilisées contenant ce produit (${periodLabelFor(period)}).`,
      summary: [
        { label: 'Quantité vendue', value: formatNumber(row.totalQuantity) },
        { label: 'Commandes', value: formatNumber(row.ordersCount) },
        { label: 'Valeur des lignes (cat.)', value: money(row.revenue) },
        {
          label: 'Part du CA catalogue',
          value: row.sharePct !== null ? `${formatDecimal(row.sharePct)} %` : 'Données insuffisantes',
        },
      ],
      orders: matchingOrders,
      highlightProductKey: row.productKey,
    });
  };

  return (
    <section id="sales_view_container" className="sales-view">
      <header className="sales-header">
        <div>
          <div className="sales-eyebrow">PILOTAGE COMMERCIAL</div>
          <h1>Ventes</h1>
          <p>Suivez la valeur catalogue des commandes validées et les montants nets enregistrés sur les bons de commande.</p>
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
          <button
            type="button"
            className="sales-export-button"
            onClick={() => setIsExportDialogOpen(true)}
            id="sales_open_export_btn"
          >
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
          label="Montant net enregistré"
          value={
            netSummary.netRecordedTotal !== null
              ? money(netSummary.netRecordedTotal)
              : 'Données insuffisantes'
          }
          deltaLabel={
            deltaNetRecorded.diff !== null
              ? formatDeltaAmount(deltaNetRecorded.diff)
              : 'Données insuffisantes'
          }
          deltaPct={deltaNetRecorded.pct}
          vsLabel={vsLabel}
          metaText={netCoverageSummary}
          icon={<Wallet size={16} />}
          tone="emerald"
          onClick={openNetRecorded}
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
        aria-label="Voir le détail de l'écart entre valeur catalogue et montant net enregistré"
      >
        <div>
          <span>Écart valeur catalogue / montant net enregistré</span>
          <strong>
            {netSummary.orderLevelGap !== null
              ? formatSignedMoney(netSummary.orderLevelGap)
              : 'Données insuffisantes'}
          </strong>
        </div>
        <small>
          Périmètre valide : {netSummary.validAmountOrdersCount} cmd (catalogue{' '}
          {money(netSummary.coveredCatalogRevenue)})
          {netSummary.missingAmountOrdersCount > 0
            ? ` · ${netSummary.missingAmountOrdersCount} sans montant`
            : ''}
          {netSummary.invalidAmountOrdersCount > 0
            ? ` · ${netSummary.invalidAmountOrdersCount} montant invalide`
            : ''}
          {' · '}Cet écart peut correspondre à une remise ou à un supplément (ex. frais de
          livraison) et ne constitue pas une preuve de paiement reçu.
        </small>
      </button>

      {/* Performance des produits — classement, part du CA, best-seller, tri interactif */}
      <section
        id="sales_product_performance_panel"
        className="sales-products-panel"
        aria-label="Performance des produits"
      >
        <div className="sales-panel-heading sales-products-heading">
          <div>
            <h2>Performance des produits</h2>
            <span>
              {productSummary.rows.length > 0
                ? `${productSummary.rows.length} produit${productSummary.rows.length > 1 ? 's' : ''} · ${formatNumber(productSummary.totalUnitsSold)} unité${productSummary.totalUnitsSold > 1 ? 's' : ''} · Valeur des lignes de vente : ${money(productSummary.totalLinesRevenue)}`
                : 'CA catalogue ventilé des lignes vendues (hors ventilation des remises globales)'}
            </span>
          </div>
          <div className="sales-product-sort" role="group" aria-label="Trier les produits">
            <button
              type="button"
              onClick={() => toggleProductSort('revenue')}
              className={productSortBy === 'revenue' ? 'is-active' : ''}
              aria-pressed={productSortBy === 'revenue'}
              id="sales_sort_product_revenue"
            >
              CA catalogue
              {productSortBy === 'revenue' &&
                (productSortDir === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
            </button>
            <button
              type="button"
              onClick={() => toggleProductSort('quantity')}
              className={productSortBy === 'quantity' ? 'is-active' : ''}
              aria-pressed={productSortBy === 'quantity'}
              id="sales_sort_product_quantity"
            >
              Quantité
              {productSortBy === 'quantity' &&
                (productSortDir === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
            </button>
          </div>
        </div>

        {productSummary.rows.length === 0 ? (
          <div className="sales-products-empty">
            <Package size={18} />
            <span>Aucune vente produit comptabilisée sur cette période.</span>
          </div>
        ) : (
          <>
            <div className="sales-table-wrap">
              <table className="sales-table sales-products-table">
                <thead>
                  <tr>
                    <th>Rang</th>
                    <th>Produit</th>
                    <th className="numeric">Quantité</th>
                    <th className="numeric">Commandes</th>
                    <th className="numeric">CA catalogue ventilé</th>
                    <th className="numeric">Part du CA cat.</th>
                  </tr>
                </thead>
                <tbody>
                  {productSummary.rows.map((row) => (
                    <tr
                      key={row.productKey}
                      className="sales-product-row is-clickable"
                      onClick={() => openProductDetail(row)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openProductDetail(row);
                        }
                      }}
                      aria-label={`Voir le détail des ventes de ${row.productName}`}
                    >
                      <td className="sales-product-rank">#{row.rank}</td>
                      <td>
                        <div className="sales-product-name-cell">
                          <strong>{row.productName}</strong>
                          {row.isBestseller && (
                            <span className="sales-bestseller-tag">
                              <Award size={11} />
                              Best-seller
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="numeric sales-product-qty">{formatNumber(row.totalQuantity)}</td>
                      <td className="numeric">{formatNumber(row.ordersCount)}</td>
                      <td className="numeric sales-amount">{money(row.revenue)}</td>
                      <td className="numeric">
                        {row.sharePct !== null ? (
                          <div className="sales-share-cell">
                            <span>{formatDecimal(row.sharePct)} %</span>
                            <div className="sales-share-track" aria-hidden="true">
                              <span style={{ width: `${Math.min(100, Math.max(2, row.sharePct))}%` }} />
                            </div>
                          </div>
                        ) : (
                          <span className="sales-insufficient">Données insuffisantes</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="sales-product-cards">
              {productSummary.rows.map((row) => (
                <button
                  key={row.productKey}
                  type="button"
                  className="sales-product-card"
                  onClick={() => openProductDetail(row)}
                  aria-label={`Voir le détail des ventes de ${row.productName}`}
                >
                  <div className="sales-product-card-top">
                    <span className="sales-product-rank">#{row.rank}</span>
                    <strong>{row.productName}</strong>
                    {row.isBestseller && (
                      <span className="sales-bestseller-tag">
                        <Award size={11} />
                        Best-seller
                      </span>
                    )}
                  </div>
                  <div className="sales-product-card-metrics">
                    <span>
                      Qté : <strong>{formatNumber(row.totalQuantity)}</strong>
                    </span>
                    <span>
                      Cmd : <strong>{formatNumber(row.ordersCount)}</strong>
                    </span>
                    <span>
                      CA cat. : <strong>{money(row.revenue)}</strong>
                    </span>
                    <span>
                      Part :{' '}
                      <strong>
                        {row.sharePct !== null
                          ? `${formatDecimal(row.sharePct)} %`
                          : 'Données insuffisantes'}
                      </strong>
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <p className="sales-products-footnote">
              <strong>Valeur des lignes de vente (CA catalogue ventilé) :</strong> calculée sur les prix
              unitaires catalogue figés à la commande (prix unitaire × quantité ={' '}
              {money(productSummary.totalLinesRevenue)}). Montant net enregistré sur les commandes :{' '}
              {productSummary.totalOrdersNetRecorded !== null
                ? money(productSummary.totalOrdersNetRecorded)
                : 'Données insuffisantes'}{' '}
              sur {productSummary.validAmountOrdersCount} commande(s) avec montant valide (valeur
              catalogue correspondante : {money(productSummary.coveredCatalogRevenue)} ; écart :{' '}
              {productSummary.totalOrderLevelGap !== null
                ? formatSignedMoney(productSummary.totalOrderLevelGap)
                : 'Données insuffisantes'}
              ).
              {productSummary.missingAmountOrdersCount > 0 &&
                ` ${productSummary.missingAmountOrdersCount} commande(s) sans montant enregistré.`}
              {productSummary.invalidAmountOrdersCount > 0 &&
                ` ${productSummary.invalidAmountOrdersCount} commande(s) avec montant invalide exclue(s) de la somme.`}
              {' '}Le montant net enregistré correspond à la valeur inscrite sur le bon de commande.
              Il ne constitue pas une preuve de paiement réellement reçu. L&apos;écart éventuel peut
              provenir d&apos;une remise, d&apos;un geste commercial ou d&apos;un supplément
              (notamment des frais de livraison), jamais réparti arbitrairement entre les produits.
            </p>
          </>
        )}
      </section>

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
                  <th className="numeric">Net enregistré</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {visibleOrders.map((order) => {
                  const inspectedNet = inspectOrderNetAmount(order);
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
                      <td className="numeric sales-paid">
                        {inspectedNet.status === 'VALID' && inspectedNet.amount !== null ? (
                          money(inspectedNet.amount)
                        ) : inspectedNet.status === 'MISSING' ? (
                          <span className="sales-insufficient">Non renseigné</span>
                        ) : (
                          <span className="sales-kpi-delta is-negative">Montant invalide</span>
                        )}
                      </td>
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
                const inspectedNet = inspectOrderNetAmount(order);
                const showNetDiff =
                  inspectedNet.status === 'VALID' &&
                  inspectedNet.amount !== null &&
                  inspectedNet.amount !== order.totalRetail;
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
                      {showNetDiff && (
                        <span className="sales-paid">Net bon {money(inspectedNet.amount!)}</span>
                      )}
                      {inspectedNet.status === 'MISSING' && (
                        <span className="sales-insufficient">Net non renseigné</span>
                      )}
                      {inspectedNet.status === 'INVALID' && (
                        <span className="sales-kpi-delta is-negative">Net invalide</span>
                      )}
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
            Le montant net enregistré correspond à la valeur inscrite sur le bon de commande. Il ne
            constitue pas une preuve de paiement réellement reçu. L&apos;écart avec la valeur
            catalogue peut correspondre à une remise comme à un supplément (notamment des frais de
            livraison).
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
        highlightProductKey={detail?.highlightProductKey}
      />

      <SalesExportDialog
        isOpen={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
        ordersCount={visibleOrders.length}
        periodLabel={periodLabelFor(period)}
        hasSearchQuery={query.trim().length > 0}
        onExport={handlePerformExport}
      />
    </section>
  );
};

export default SalesView;