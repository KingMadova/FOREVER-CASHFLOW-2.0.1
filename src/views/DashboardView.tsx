import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  Target,
  Users,
  Layers,
  Plus,
  ChevronRight,
  Flame,
  Award,
  Wallet,
  Receipt,
  Pencil,
} from 'lucide-react';

import { useAuthStore } from '../store/slices/authSlice';
import { useCustomersStore } from '../store/slices/customersSlice';
import { useOrdersStore } from '../store/slices/ordersSlice';
import { useBudgetStore } from '../store/slices/budgetSlice';
import { useDailyLogsStore } from '../store/slices/dailyLogsSlice';
import { isCountedOrder, orderAccountingDate } from '../lib/orderStats';
import { GRADES, OrderStatut } from '../types';

import { HeroCard } from '../components/ui/dashboard/HeroCard';
import { StatRow } from '../components/ui/dashboard/StatRow';
import { ProgressRow } from '../components/ui/dashboard/ProgressRow';
import { DonutChart, DonutLegend, type DonutSegment } from '../components/ui/dashboard/DonutChart';
import { ActivityList, type ActivityItem } from '../components/ui/dashboard/ActivityList';
import { formatCC, formatMoney } from '../lib/format';
import './DashboardView.css';

const STATUS_SHORT: Record<OrderStatut, string> = {
  PENDING: 'En attente',
  VALIDATED: 'Validée',
  PAYE: 'Payée',
  LIVRE: 'Livrée',
  CANCELLED: 'Annulée',
  RETOUR: 'Retour',
  REMPLACEMENT: 'Rempl.',
};

const STATUS_TONE: Record<OrderStatut, 'gold' | 'emerald' | 'blue' | 'rose' | 'violet' | 'slate'> = {
  PENDING: 'gold',
  VALIDATED: 'emerald',
  PAYE: 'emerald',
  LIVRE: 'blue',
  CANCELLED: 'slate',
  RETOUR: 'rose',
  REMPLACEMENT: 'violet',
};

const DONUT_COLORS = ['#C1440E', '#F9A825', '#2563A6', '#7964C8', '#16845B', '#756B63'];

export const DashboardView: React.FC = () => {
  const { orders } = useOrdersStore();
  const { customers } = useCustomersStore();
  const { budget } = useBudgetStore();
  const { profile, updateProfile } = useAuthStore();
  const { getDailyLog, dailyLogs } = useDailyLogsStore();
  const navigate = useNavigate();

  const [isEditingGoals, setIsEditingGoals] = useState(false);
  const [goalCCInput, setGoalCCInput] = useState('');
  const [goalAmountInput, setGoalAmountInput] = useState('');

  useEffect(() => {
    if (profile) {
      setGoalCCInput((profile.monthlyGoalCC || 0).toString());
      setGoalAmountInput((profile.monthlyGoalAmount || 0).toString());
    }
  }, [profile.monthlyGoalCC, profile.monthlyGoalAmount]);

  const handleSaveGoals = async (e: React.FormEvent) => {
    e.preventDefault();
    const cc = parseFloat(goalCCInput) || 0;
    const amt = parseInt(goalAmountInput) || 0;
    await updateProfile({
      ...profile,
      monthlyGoalCC: cc,
      monthlyGoalAmount: amt,
    });
    setIsEditingGoals(false);
  };

  const [currentDateRef, setCurrentDateRef] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      if (now.getMonth() !== currentDateRef.getMonth() || now.getFullYear() !== currentDateRef.getFullYear()) {
        setCurrentDateRef(now);
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [currentDateRef]);

  const currentMonth = currentDateRef.getMonth();
  const currentYear = currentDateRef.getFullYear();

  const thisMonthOrders = orders.filter((o) => {
    const oDate = new Date(orderAccountingDate(o));
    return oDate.getMonth() === currentMonth && oDate.getFullYear() === currentYear;
  });

  const lastMonthDate = new Date(currentDateRef);
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastMonth = lastMonthDate.getMonth();
  const lastYear = lastMonthDate.getFullYear();

  const lastMonthOrders = orders.filter((o) => {
    const oDate = new Date(orderAccountingDate(o));
    return oDate.getMonth() === lastMonth && oDate.getFullYear() === lastYear;
  });

  const totalCCThisMonth = thisMonthOrders.filter(isCountedOrder).reduce((s, o) => s + o.totalCC, 0);
  const totalCCLastMonth = lastMonthOrders.filter(isCountedOrder).reduce((s, o) => s + o.totalCC, 0);
  const totalMarginThisMonth = thisMonthOrders.filter(isCountedOrder).reduce((s, o) => s + o.totalMargin, 0);
  const totalMarginLastMonth = lastMonthOrders.filter(isCountedOrder).reduce((s, o) => s + o.totalMargin, 0);
  const totalAmountThisMonth = thisMonthOrders.filter(isCountedOrder).reduce((s, o) => s + o.totalRetail, 0);

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const marginChange = calculateChange(totalMarginThisMonth, totalMarginLastMonth);
  const ccChange = calculateChange(totalCCThisMonth, totalCCLastMonth);

  const activeClientsCount = customers.filter((c) => c.status === 'CLIENT').length;

  const thisMonthExpenses = budget
    .filter((b) => b.type === 'EXPENSE')
    .filter((b) => {
      const bDate = new Date(b.date);
      return bDate.getMonth() === currentMonth && bDate.getFullYear() === currentYear;
    })
    .reduce((s, b) => s + b.amount, 0);

  const netCashflow = totalMarginThisMonth - thisMonthExpenses;
  const currentGrade = GRADES.find((g) => g.code === profile.grade) || GRADES[1];

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

  const chartData = last7Days.map((date) => {
    const dayLabel = date.toLocaleDateString('fr-FR', { weekday: 'short' });
    const dayOrders = orders.filter((o) => {
      const oDate = new Date(orderAccountingDate(o) + 'T00:00:00');
      return oDate.toDateString() === date.toDateString() && isCountedOrder(o);
    });
    return {
      day: dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1, 3),
      Marge: dayOrders.reduce((s, o) => s + o.totalMargin, 0),
    };
  });

  const recentOrders = [...orders]
    .sort((a, b) => new Date(orderAccountingDate(b)).getTime() - new Date(orderAccountingDate(a)).getTime())
    .slice(0, 3);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayLog = getDailyLog(todayStr);
  const checksDone = todayLog
    ? [todayLog.consumedProduct, todayLog.trained, todayLog.statusMorning, todayLog.statusNoon, todayLog.statusEvening].filter(Boolean).length
    : 0;
  const countersDone = todayLog
    ? [(todayLog.contactsAdded || 0) >= 5, (todayLog.conversationsStarted || 0) >= 100].filter(Boolean).length
    : 0;
  const dayScore = checksDone + countersDone;
  const dayScorePct = Math.round((dayScore / 7) * 100);

  const streak = (() => {
    let count = 0;
    const d = new Date(todayStr + 'T00:00:00');
    while (true) {
      const ds = d.toISOString().split('T')[0];
      const l = getDailyLog(ds);
      if (!l || (!l.consumedProduct && !l.trained && !(l.contactsAdded && l.contactsAdded > 0))) break;
      count++;
      d.setDate(d.getDate() - 1);
    }
    return count;
  })();

  const nowDate = new Date();
  const monthStart = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-01`;
  const monthContacts = dailyLogs.filter((l) => l.date >= monthStart).reduce((s, l) => s + (l.contactsAdded || 0), 0);
  const monthPresentations = dailyLogs
    .filter((l) => l.date >= monthStart)
    .reduce((s, l) => s + (l.oneToOne || 0) + (l.miniConferences || 0) * 3 + (l.conferences || 0) * 5 + (l.boutiques || 0) * 5, 0);

  const expensesByCategory = (() => {
    const map = new Map<string, number>();
    budget
      .filter((b) => b.type === 'EXPENSE')
      .filter((b) => {
        const bDate = new Date(b.date);
        return bDate.getMonth() === currentMonth && bDate.getFullYear() === currentYear;
      })
      .forEach((b) => map.set(b.category, (map.get(b.category) || 0) + b.amount));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  })();

  const donutSegments: DonutSegment[] = expensesByCategory.map(([label, value], i) => ({
    label,
    value,
    color: DONUT_COLORS[i % DONUT_COLORS.length],
  }));

  const recentActivities: ActivityItem[] = recentOrders.map((o) => ({
    id: o.id,
    icon: <Receipt size={16} />,
    iconTone: STATUS_TONE[o.status],
    title: o.customerName,
    subtitle: `${o.refCommande || o.id} · ${o.items.length} article(s)`,
    trailing: (
      <div className="activity-trailing-inner">
        <span className="activity-amount">{formatMoney(o.totalRetail)}</span>
        <span className={`activity-status is-${STATUS_TONE[o.status]}`}>{STATUS_SHORT[o.status]}</span>
      </div>
    ),
    onClick: () => navigate('/orders'),
  }));

  const marginChangeLabel =
    marginChange === 0
      ? 'Stable vs mois précédent'
      : `${marginChange > 0 ? '+' : ''}${Math.round(marginChange)}% vs mois précédent`;

  return (
    <div id="dashboard_view_container" className="dashboard-view">
      {/* 1. Header greeting */}
      <header className="dashboard-header">
        <div>
          <span className="dashboard-eyebrow">TABLEAU DE BORD</span>
          <h2>Bonjour, {profile.name || 'FBO'}</h2>
          <p>
            Grade actuel : <strong>{currentGrade.label}</strong>          </p>
        </div>
        <div className="dashboard-header-actions">
          <button type="button" className="dashboard-primary-action" onClick={() => navigate('/projection')}>
            <TrendingUp size={16} />
            Projection
          </button>
          <button
            type="button"
            className="dashboard-icon-action"
            onClick={() => navigate('/orders')}
            aria-label="Ajouter une vente"
          >
            <Plus size={18} />
          </button>
        </div>
      </header>

      {/* 2. Hero marge */}
      <HeroCard
        label="Marge ce mois"
        value={formatMoney(totalMarginThisMonth)}
        change={marginChangeLabel}
        positive={marginChange >= 0}
        icon={<Wallet size={20} />}
      />

      {/* 3. Objectifs + Clients */}
      <section className="dashboard-section">
        <div className="dashboard-section-header">
          <h3 className="dashboard-section-title">Objectifs du mois</h3>
          <button
            type="button"
            className="dashboard-section-action"
            onClick={() => setIsEditingGoals((v) => !v)}
          >
            <Pencil size={13} />
            {isEditingGoals ? 'Annuler' : 'Modifier'}
          </button>
        </div>

        {isEditingGoals ? (
          <form onSubmit={handleSaveGoals} className="dashboard-goals-form">
            <label>
              <span>Objectif CC</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={goalCCInput}
                onChange={(e) => setGoalCCInput(e.target.value)}
                placeholder="4.0"
              />
            </label>
            <label>
              <span>Objectif ventes (FCFA)</span>
              <input
                type="number"
                min="0"
                value={goalAmountInput}
                onChange={(e) => setGoalAmountInput(e.target.value)}
                placeholder="1000000"
              />
            </label>
            <button type="submit" className="dashboard-goals-submit">
              Enregistrer
            </button>
          </form>
        ) : (
          <div className="dashboard-goals-list">
            <ProgressRow
              icon={<Award size={16} />}
              label="Volume CC"
              current={totalCCThisMonth}
              target={profile.monthlyGoalCC || 0}
              format={(n) => n.toFixed(3)}
              tone="gold"
            />
            <ProgressRow
              icon={<Target size={16} />}
              label="Chiffre d'affaires"
              current={totalAmountThisMonth}
              target={profile.monthlyGoalAmount || 0}
              format={(n) => formatMoney(n)}
              tone="emerald"
            />
            <StatRow
              icon={<Users size={16} />}
              label="Base clients"
              hint="Clients actifs enregistrés"
              value={String(activeClientsCount)}
              tone="blue"
              onClick={() => navigate('/clients')}
            />
          </div>
        )}
      </section>

      {/* 4. Répartition dépenses */}
      <section className="dashboard-section">
        <div className="dashboard-section-header">
          <h3 className="dashboard-section-title">Répartition des dépenses</h3>
          <button type="button" className="dashboard-section-action" onClick={() => navigate('/budget')}>
            Voir budget
            <ChevronRight size={13} />
          </button>
        </div>
        {donutSegments.length > 0 ? (
          <div className="dashboard-donut-wrap">
            <DonutChart
              segments={donutSegments}
              centerLabel="Dépenses"
              centerValue={formatMoney(thisMonthExpenses)}
            />
            <DonutLegend segments={donutSegments} formatValue={(n) => formatMoney(n)} />
          </div>
        ) : (
          <p className="dashboard-empty">Aucune dépense enregistrée ce mois.</p>
        )}
      </section>

      {/* 5. Graphique 7 jours */}
      <section className="dashboard-section">
        <div className="dashboard-section-header">
          <h3 className="dashboard-section-title">Performance hebdomadaire</h3>
          <span className="dashboard-section-hint">
            {ccChange >= 0 ? '+' : ''}
            {ccChange.toFixed(1)} % CC
          </span>
        </div>
        <div className="dashboard-chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="margeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F9A825" stopOpacity={0.32} />
                  <stop offset="95%" stopColor="#F9A825" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--fcf-border)" />
              <XAxis dataKey="day" stroke="var(--fcf-muted)" fontSize={11} fontWeight="bold" tickLine={false} />
              <YAxis stroke="var(--fcf-muted)" fontSize={10} fontWeight="bold" tickLine={false} />
              <ChartTooltip
                contentStyle={{
                  backgroundColor: 'var(--fcf-surface)',
                  borderRadius: '12px',
                  color: 'var(--fcf-foreground)',
                  border: '1px solid var(--fcf-border)',
                  fontSize: '12px',
                }}
              />
              <Area type="monotone" dataKey="Marge" name="Marge (F)" stroke="#C1440E" strokeWidth={2.5} fillOpacity={1} fill="url(#margeGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 6. Widget G4 */}
      <button
        type="button"
        className="dashboard-g4-card"
        onClick={() => navigate('/tracker')}
        aria-label="Ouvrir le journal G4"
      >
        <div className="dashboard-g4-top">
          <div>
            <p className="dashboard-g4-label">Journal G4 · Aujourd'hui</p>
            <p className="dashboard-g4-score">
              {dayScore}
              <span className="dashboard-g4-score-max">/7</span>
            </p>
          </div>
          <div className="dashboard-g4-side">
            {streak > 0 && (
              <span className="dashboard-g4-streak">
                <Flame size={14} />
                {streak}j
              </span>
            )}
            <ChevronRight size={16} />
          </div>
        </div>
        <div className="dashboard-g4-bar">
          <div
            className="dashboard-g4-bar-fill"
            style={{
              width: `${dayScorePct}%`,
              background:
                dayScorePct >= 80 ? '#4CC38A' : dayScorePct >= 50 ? '#E8B45B' : '#F07878',
            }}
          />
        </div>
        <div className="dashboard-g4-stats">
          <div>
            <p className="dashboard-g4-stat-label">Contacts mois</p>
            <p className="dashboard-g4-stat-value">
              {monthContacts}
              <span className="dashboard-g4-stat-max">/150</span>
            </p>
          </div>
          <div>
            <p className="dashboard-g4-stat-label">Présentations</p>
            <p className="dashboard-g4-stat-value">
              {monthPresentations}
              <span className="dashboard-g4-stat-max">/150</span>
            </p>
          </div>
        </div>
      </button>

      {/* 7. Commandes récentes */}
      <section className="dashboard-section">
        <div className="dashboard-section-header">
          <h3 className="dashboard-section-title">Commandes récentes</h3>
          <button type="button" className="dashboard-section-action" onClick={() => navigate('/orders')}>
            Tout voir
            <ChevronRight size={13} />
          </button>
        </div>
        <ActivityList
          items={recentActivities}
          onSeeAll={() => navigate('/orders')}
          seeAllLabel="Toutes les commandes"
          emptyMessage="Aucune commande enregistrée pour le moment."
        />
      </section>

      {/* Hidden refs for downstream components */}
      <div style={{ display: 'none' }} id="dashboard_kpi_grid" aria-hidden="true">
        {formatCC(totalCCThisMonth)}
        <span data-net-cashflow={netCashflow} />
        <Layers size={0} />
      </div>
    </div>
  );
};

export default DashboardView;