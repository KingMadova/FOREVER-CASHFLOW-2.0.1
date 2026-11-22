import React, { useState, useEffect, useMemo } from 'react';
import { printCanvas } from '../lib/printHelper';
import { SortSelect } from '../components/ui/SortSelect';
import { useSortPref, sortList, BUDGET_SORT_OPTIONS, budgetComparators } from '../lib/sortHelper';
import { useBudgetStore } from '../store/slices/budgetSlice';
import { useAuthStore } from '../store/slices/authSlice';
import { Drawer } from '../components/ui/Drawer';
import { BudgetEntry } from '../types';
import { useActionFeedback } from '../hooks/useActionFeedback';
// ─── Design System Arc ─────────────────────────────────────────
import { Input } from '../components/arc/input/input';
import { Select, type SelectOption } from '../components/arc/select/select';
import { Textarea } from '../components/arc/textarea/textarea';
import { Button } from '../components/arc/button/button';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  AreaChart, Area, XAxis, Tooltip, CartesianGrid,
} from 'recharts';
import {
  Plus, Trash2, TrendingUp, TrendingDown,
  Download, ChevronLeft, ChevronRight,
  Wallet, Pencil, Printer, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import './BudgetView.css';

// ─── Palette graphiques (extraite de la référence visuelle) ─────
const CHART_PALETTE = [
  '#7DD3FC', // sky
  '#6366F1', // indigo
  '#22C55E', // green
  '#6B7280', // slate
  '#FB923C', // orange
  '#A855F7', // purple
  '#EC4899', // pink
  '#14B8A6', // teal
];
const COLOR_SOLDE = '#D4F542'; // lime
const COLOR_SORTIE = '#FB7185'; // coral
const COLOR_ENTREE = '#22C55E'; // green

// ─── Catégories pour le Select du formulaire ────────────────────
const EXPENSE_CATEGORIES: SelectOption[] = [
  { value: 'Carburant', label: 'Carburant (Livraison)' },
  { value: 'Logistique', label: 'Logistique / Fret FLP' },
  { value: 'Publicité', label: 'Publicité (Facebook/Instagram)' },
  { value: 'Internet', label: 'Internet (Recharges Data)' },
  { value: 'Prospection', label: 'Prospection & Espace café' },
  { value: 'Divers', label: 'Divers / Autre frais' },
];
const REVENUE_CATEGORIES: SelectOption[] = [
  { value: 'Bonus FLP', label: 'Bonus réseau FLP trimestriel ou mensuel' },
  { value: 'Vente Directe FBO', label: 'Vente Directe FBO (Marge)' },
  { value: 'Autre', label: 'Autre gain' },
];

const MONTH_LABELS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

// ─── Types de filtre ───────────────────────────────────────────
type TypeFilter = 'ALL' | 'REVENUE' | 'EXPENSE';

export const BudgetView: React.FC = () => {
  const { budget, addBudgetEntry, updateBudgetEntry, deleteBudgetEntry } = useBudgetStore();
  const { profile } = useAuthStore();

  const { executeAction, confirmAction, isActionPending, notifySuccess, notifyError } = useActionFeedback();

  // ─── Filtres ────────────────────────────────────────────────
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [budgetSort, setBudgetSort] = useSortPref('fcf-sort-budget', BUDGET_SORT_OPTIONS, 'date_desc');

  // ─── Dialog ─────────────────────────────────────────────────
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const isSubmitting = isActionPending(editingId ? `budget-update-${editingId}` : 'budget-add');

  // ─── Form fields ────────────────────────────────────────────
  const [newType, setNewType] = useState<'REVENUE' | 'EXPENSE'>('EXPENSE');
  const [amount, setAmount] = useState<number>(0);
  const [category, setCategory] = useState<string>('Carburant');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // ─── Date de référence (détecte le changement de mois) ──────
  const [currentDateRef, setCurrentDateRef] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => {
      const n = new Date();
      setCurrentDateRef(prev =>
        n.getMonth() !== prev.getMonth() || n.getFullYear() !== prev.getFullYear() ? n : prev,
      );
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  // ─── Navigateur de mois ────────────────────────────────────
  const [monthOffset, setMonthOffset] = useState(0);
  const viewedDate = new Date(
    currentDateRef.getFullYear(),
    currentDateRef.getMonth() + monthOffset,
    1,
  );
  const currentMonthKey = `${viewedDate.getFullYear()}-${String(viewedDate.getMonth() + 1).padStart(2, '0')}`;
  const currentMonthLabel = `${MONTH_LABELS_FR[viewedDate.getMonth()]} ${viewedDate.getFullYear()}`;

  const lastMonthDate = new Date(viewedDate);
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

  const currentMonthBudget = budget.filter(b => b.date.startsWith(currentMonthKey));
  const lastMonthBudget = budget.filter(b => b.date.startsWith(lastMonthKey));

  // ─── Totaux globaux du mois affiché (indépendants du filtre type) ──
  const totalRevenue = currentMonthBudget
    .filter(b => b.type === 'REVENUE')
    .reduce((sum, b) => sum + b.amount, 0);
  const totalExpense = currentMonthBudget
    .filter(b => b.type === 'EXPENSE')
    .reduce((sum, b) => sum + b.amount, 0);
  const netBalance = totalRevenue - totalExpense;

  const lastRevenue = lastMonthBudget
    .filter(b => b.type === 'REVENUE')
    .reduce((s, b) => s + b.amount, 0);
  const lastExpense = lastMonthBudget
    .filter(b => b.type === 'EXPENSE')
    .reduce((s, b) => s + b.amount, 0);

  // Variation vs mois précédent (utilisée dans le hero badge)
// Variation du solde net par rapport au mois précédent
const lastNetBalance = lastRevenue - lastExpense;
const netChange = netBalance - lastNetBalance;

const netDelta =
  lastNetBalance !== 0
    ? Math.round((netChange / Math.abs(lastNetBalance)) * 100)
    : null;

const trend =
  netChange > 0 ? 'up' : netChange < 0 ? 'down' : 'neutral';

  // ─── Données du donut (dépend du filtre) ────────────────────
  const donutData = useMemo(() => {
    const filtered =
      typeFilter === 'ALL' ? currentMonthBudget : currentMonthBudget.filter(b => b.type === typeFilter);
    const map = new Map<string, number>();
    for (const entry of filtered) {
      map.set(entry.category, (map.get(entry.category) || 0) + entry.amount);
    }
    const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
    const total = sorted.reduce((s, [, v]) => s + v, 0);
    return sorted.map(([label, value], i) => ({
      label,
      value,
      percent: total > 0 ? Math.round((value / total) * 100) : 0,
      color: CHART_PALETTE[i % CHART_PALETTE.length],
    }));
  }, [currentMonthBudget, typeFilter]);

  const donutTopPercent = donutData.length > 0 ? donutData[0].percent : 0;

  // ─── Données de la pie (flux global, non filtré) ────────────
  const pieData = useMemo(() => {
    const arr: { name: string; value: number; color: string }[] = [];
    if (totalRevenue > 0) arr.push({ name: 'Entrées', value: totalRevenue, color: COLOR_ENTREE });
    if (totalExpense > 0) arr.push({ name: 'Sorties', value: totalExpense, color: COLOR_SORTIE });
    return arr;
  }, [totalRevenue, totalExpense]);

  const pieTotal = totalRevenue + totalExpense;

  // ─── Tendance 7 mois (se termine au mois affiché) ──────────
  const trendData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(viewedDate.getFullYear(), viewedDate.getMonth() - (6 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const entries = budget.filter(b => b.date.startsWith(key));
      const rev = entries.filter(b => b.type === 'REVENUE').reduce((s, b) => s + b.amount, 0);
      const exp = entries.filter(b => b.type === 'EXPENSE').reduce((s, b) => s + b.amount, 0);
      return {
        month: d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''),
        key,
        Solde: rev - exp,
      };
    });
  }, [budget, viewedDate]);

  // ─── Liste des transactions filtrées + triées ───────────────
  const filteredTransactions = useMemo(() => {
    const filtered =
      typeFilter === 'ALL' ? budget : budget.filter(b => b.type === typeFilter);
    return sortList(filtered, budgetSort, budgetComparators);
  }, [budget, typeFilter, budgetSort]);

  // ─── PDF totals all-time (pour le canvas imprimable) ────────
  const totalRevenueAllTime = budget
    .filter(b => b.type === 'REVENUE')
    .reduce((s, b) => s + b.amount, 0);
  const totalExpenseAllTime = budget
    .filter(b => b.type === 'EXPENSE')
    .reduce((s, b) => s + b.amount, 0);

  // ─── Formulaire ─────────────────────────────────────────────
  const resetForm = () => {
    setNewType('EXPENSE');
    setCategory('Carburant');
    setAmount(0);
    setDate(new Date().toISOString().split('T')[0]);
    setDescription('');
    setEditingId(null);
    setFormError(null);
  };

  const openAdd = () => {
    resetForm();
    setIsAddOpen(true);
  };

  const openEdit = (b: BudgetEntry) => {
    setEditingId(b.id);
    setNewType(b.type);
    setCategory(b.category);
    setAmount(b.amount);
    setDate(b.date);
    setDescription(b.description || '');
    setFormError(null);
    setIsAddOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      const msg = 'Veuillez entrer un montant supérieur à 0.';
      setFormError(msg);
      notifyError(msg);
      return;
    }
    setFormError(null);

    if (editingId) {
      const existing = budget.find(b => b.id === editingId);
      if (!existing) {
        const msg = 'Transaction introuvable.';
        setFormError(msg);
        notifyError(msg);
        return;
      }
      await executeAction({
        actionKey: `budget-update-${editingId}`,
        operation: () =>
          updateBudgetEntry({
            ...existing,
            type: newType,
            category,
            amount,
            date,
            description,
          }),
        successMessage: 'Transaction modifiée avec succès !',
        errorContext: 'Échec de la modification de la transaction',
        redirectToDashboard: true,
        onSuccess: () => {
          setIsAddOpen(false);
          resetForm();
        },
        onError: (msg) => {
          setFormError(msg);
        },
      });
      return;
    }

    await executeAction({
      actionKey: 'budget-add',
      operation: () =>
        addBudgetEntry({
          type: newType,
          category,
          amount,
          date,
          description,
          createdAt: new Date().toISOString(),
        }),
      successMessage: 'Budget enregistré avec succès !',
      queuedMessage: 'Mouvement budgétaire enregistré hors-ligne (en attente de synchronisation).',
      errorContext: "Échec de l'enregistrement du budget",
      redirectToDashboard: true,
      onSuccess: () => {
        setIsAddOpen(false);
        resetForm();
      },
      onError: (msg) => {
        setFormError(msg);
      },
    });
  };

  const handleDeleteBudget = async (id: string) => {
    const confirmed = await confirmAction({
      title: 'Supprimer la transaction',
      message: 'Voulez-vous supprimer définitivement ce mouvement budgétaire ?',
      confirmLabel: 'Oui, supprimer',
      cancelLabel: 'Annuler',
      tone: 'danger',
    });
    if (!confirmed) return;

    await executeAction({
      actionKey: `budget-delete-${id}`,
      operation: () => deleteBudgetEntry(id),
      successMessage: 'Transaction supprimée avec succès !',
      errorContext: 'Échec de la suppression de la transaction',
      redirectToDashboard: true,
    });
  };

  // ─── Export CSV ─────────────────────────────────────────────
  const handleExportCSV = () => {
    const headers = ['Date', 'Type', 'Categorie', 'Description', 'Montant (FCFA)'];
    const rows = filteredTransactions.map(b => [
      b.date,
      b.type === 'REVENUE' ? 'Entree' : 'Sortie',
      b.category,
      b.description || b.category,
      b.amount,
    ]);
    const csvContent =
      '\uFEFF' +
      [headers, ...rows]
        .map(row =>
          row
            .map(val => {
              const str = String(val ?? '').replace(/"/g, '""');
              return `"${str}"`;
            })
            .join(';'),
        )
        .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `FCF_Tresorerie_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notifySuccess('Export Excel de trésorerie téléchargé !');
  };

  const handlePrintBudget = async () => {
    await printCanvas('report_printable_canvas');
  };

  // ─── Catégories du Select selon le type courant ─────────────
  const categoryOptions = newType === 'EXPENSE' ? EXPENSE_CATEGORIES : REVENUE_CATEGORIES;

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div id="budget_view_container">

      {/* ─── 1. Header ─────────────────────────────────────── */}
      <header className="budget-header">
        <div className="budget-header-text">
          <div className="budget-eyebrow">PILOTAGE FINANCIER</div>
          <h2>Trésorerie & Budget</h2>
          <p>Suivez vos entrées, vos sorties et votre solde net mois par mois.</p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="budget-add-btn"
          id="budget_add_btn"
          aria-label="Noter un frais ou un bonus"
        >
          <Plus className="w-4 h-4" />
          <span className="budget-add-btn-label">Noter un frais / bonus</span>
        </button>
      </header>

      {/* ─── 2. Hero card (style VISA) ─────────────────────── */}
      <section className="budget-hero" aria-label="Solde net du mois">
        <div className="budget-hero-top">
          <div>
            <div className="budget-hero-eyebrow">Solde net · {currentMonthLabel}</div>
          </div>
          <span className={`budget-hero-status is-${trend}`}>
  {trend === 'up' && <ArrowUpRight className="w-3 h-3" />}
  {trend === 'down' && <ArrowDownRight className="w-3 h-3" />}
  {netDelta === null
    ? netChange === 0 ? 'Stable' : 'Nouveau'
    : `${Math.abs(netDelta)}%`}
</span>
        </div>

        <div className="budget-hero-value">
          {netBalance.toLocaleString('fr-FR')}
          <small>F</small>
        </div>

        <div className="budget-hero-splits">
          <div className="budget-hero-split is-in">
            <span>Entrées</span>
            <strong>+{totalRevenue.toLocaleString('fr-FR')} F</strong>
          </div>
          <div className="budget-hero-split is-out">
            <span>Sorties</span>
            <strong>{totalExpense > 0 ? '−' : ''}{totalExpense.toLocaleString('fr-FR')} F</strong>
          </div>
        </div>

        <div className="budget-hero-nav">
          <button
            type="button"
            onClick={() => setMonthOffset(m => m - 1)}
            className="budget-hero-nav-btn"
            aria-label="Mois précédent"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="budget-hero-nav-label">{currentMonthLabel}</span>
          <button
            type="button"
            onClick={() => setMonthOffset(m => Math.min(0, m + 1))}
            disabled={monthOffset === 0}
            className="budget-hero-nav-btn"
            aria-label="Mois suivant"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {monthOffset !== 0 && (
            <button
              type="button"
              onClick={() => setMonthOffset(0)}
              className="budget-hero-today"
            >
              Aujourd'hui
            </button>
          )}
        </div>
      </section>

      {/* ─── 3. Filtres pills ──────────────────────────────── */}
      <div className="budget-filters" role="group" aria-label="Filtrer par type">
        <button
          type="button"
          onClick={() => setTypeFilter('ALL')}
          className={`budget-filter-pill ${typeFilter === 'ALL' ? 'is-active' : ''}`}
        >
          <span className="dot" style={{ background: '#7DD3FC' }} />
          Tout
        </button>
        <button
          type="button"
          onClick={() => setTypeFilter('EXPENSE')}
          className={`budget-filter-pill ${typeFilter === 'EXPENSE' ? 'is-active' : ''}`}
        >
          <span className="dot" style={{ background: COLOR_SORTIE }} />
          Sorties
        </button>
        <button
          type="button"
          onClick={() => setTypeFilter('REVENUE')}
          className={`budget-filter-pill ${typeFilter === 'REVENUE' ? 'is-active' : ''}`}
        >
          <span className="dot" style={{ background: COLOR_ENTREE }} />
          Entrées
        </button>
      </div>

      {/* ─── 4. Charts grid (donut + pie) ──────────────────── */}
      <div className="budget-charts">
        {/* Donut : répartition par catégorie */}
        <div className="budget-chart-card">
          <h3 className="budget-chart-title">
            {typeFilter === 'REVENUE'
              ? 'Revenus par source'
              : typeFilter === 'EXPENSE'
                ? 'Dépenses par poste'
                : 'Répartition globale'}
          </h3>
          {donutData.length === 0 ? (
            <div className="budget-chart-empty">Aucune donnée ce mois</div>
          ) : (
            <>
              <div className="budget-chart-canvas">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={72}
                      paddingAngle={3}
                      stroke="none"
                      animationDuration={450}
                    >
                      {donutData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="budget-chart-center">
                  <strong>{donutTopPercent}%</strong>
                  <span>{donutData[0].label}</span>
                </div>
              </div>
              <ul className="budget-chart-legend">
                {donutData.slice(0, 4).map(item => (
                  <li key={item.label}>
                    <span className="dot" style={{ background: item.color }} />
                    <span className="label">{item.label}</span>
                    <span className="value">{item.percent}%</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Pie : flux Entrées vs Sorties */}
        <div className="budget-chart-card">
          <h3 className="budget-chart-title">Flux financiers</h3>
          {pieData.length === 0 ? (
            <div className="budget-chart-empty">Aucun flux ce mois</div>
          ) : (
            <>
              <div className="budget-chart-canvas">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={0}
                      outerRadius={72}
                      stroke="none"
                      animationDuration={450}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="budget-chart-legend">
                {pieData.map(item => (
                  <li key={item.name}>
                    <span className="dot" style={{ background: item.color }} />
                    <span className="label">{item.name}</span>
                    <span className="value">
                      {pieTotal > 0 ? Math.round((item.value / pieTotal) * 100) : 0}%
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* ─── 5. Trend card (7 mois) ─────────────────────────── */}
      <div className="budget-trend-card">
        <div className="budget-trend-header">
          <h3 className="budget-trend-title">Évolution · 7 derniers mois</h3>
          <span className="budget-trend-pill">
            <span className="dot" />
            Solde
          </span>
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart
            data={trendData}
            margin={{ top: 5, right: 5, left: 5, bottom: 0 }}
          >
            <defs>
              <linearGradient id="budgetSoldeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLOR_SOLDE} stopOpacity={0.35} />
                <stop offset="95%" stopColor={COLOR_SOLDE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="var(--fcf-border)"
            />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: 'var(--fcf-muted)' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--fcf-surface)',
                border: '1px solid var(--fcf-border)',
                borderRadius: 8,
                fontSize: 12,
                color: 'var(--fcf-foreground)',
              }}
              labelStyle={{ color: 'var(--fcf-muted)', fontWeight: 700 }}
              formatter={(value: number) => [`${value.toLocaleString('fr-FR')} F`, 'Solde']}
            />
            <Area
              type="monotone"
              dataKey="Solde"
              stroke={COLOR_SOLDE}
              strokeWidth={2.5}
              fill="url(#budgetSoldeGradient)"
              animationDuration={500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ─── 6. Liste des transactions ──────────────────────── */}
      <div className="budget-list-header">
        <h3 className="budget-list-title">
          Mouvements ({filteredTransactions.length})
        </h3>
        <div className="budget-list-tools">
          <SortSelect
            options={BUDGET_SORT_OPTIONS}
            value={budgetSort}
            onChange={setBudgetSort}
            id="budget_sort_select"
          />
          <button
            type="button"
            onClick={handleExportCSV}
            className="budget-tool-btn"
            title="Exporter en CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="label">CSV</span>
          </button>
          <button
            type="button"
            onClick={handlePrintBudget}
            className="budget-tool-btn"
            title="Imprimer le rapport PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="label">PDF</span>
          </button>
        </div>
      </div>

      <div className="budget-tx-list" id="budget_mapping_area">
        {filteredTransactions.length === 0 ? (
          <div className="budget-tx-empty">
            {typeFilter === 'ALL'
              ? 'Aucun mouvement ce mois. Cliquez sur "Noter un frais / bonus" pour démarrer.'
              : typeFilter === 'EXPENSE'
                ? 'Aucune sortie enregistrée ce mois.'
                : 'Aucune entrée enregistrée ce mois.'}
          </div>
        ) : (
          filteredTransactions.map(b => (
            <div key={b.id} id={`budget_card_${b.id}`} className="budget-tx-row">
              <div className={`budget-tx-icon ${b.type === 'REVENUE' ? 'is-revenue' : 'is-expense'}`}>
                {b.type === 'REVENUE'
                  ? <ArrowUpRight className="w-4 h-4" />
                  : <ArrowDownRight className="w-4 h-4" />}
              </div>
              <div className="budget-tx-body">
                <div className="budget-tx-tags">
                  <span className="date">{b.date}</span>
                  <span className="chip">{b.category}</span>
                  {b.orderId ? (
                    <span className="chip is-sale" title="Marge générée par une vente validée">
                      Vente
                    </span>
                  ) : (
                    <span className="chip is-manual" title="Saisi manuellement">
                      Manuel
                    </span>
                  )}
                  {b.synced === false && (
                    <span className="chip is-offline" title="En attente de synchronisation">
                      Hors-ligne
                    </span>
                  )}
                </div>
                <p className="budget-tx-desc">{b.description || b.category}</p>
              </div>
              <div className={`budget-tx-amount ${b.type === 'REVENUE' ? 'is-revenue' : 'is-expense'}`}>
                {b.type === 'REVENUE' ? '+' : '−'}{b.amount.toLocaleString('fr-FR')} F
              </div>
              <div className="budget-tx-actions">
                {!b.orderId && (
                  <button
                    type="button"
                    onClick={() => openEdit(b)}
                    className="budget-tx-btn"
                    title="Modifier"
                    id={`budget_edit_${b.id}`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDeleteBudget(b.id)}
                  disabled={isActionPending(`budget-delete-${b.id}`)}
                  className="budget-tx-btn is-danger"
                  title="Supprimer"
                  id={`budget_delete_${b.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ─── 7. Drawer ajout/édition ────────────────────────── */}
      <Drawer
        isOpen={isAddOpen}
        onClose={() => {
          setIsAddOpen(false);
          resetForm();
        }}
        title={editingId ? 'Modifier la transaction' : 'Noter un mouvement'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="budget-form-error" role="alert">{formError}</div>
          )}

          {/* Toggle Sortie / Entrée */}
          <div className="budget-form-toggle">
            <button
              type="button"
              onClick={() => {
                setNewType('EXPENSE');
                setCategory('Carburant');
                setFormError(null);
              }}
              className={`budget-form-toggle-btn ${newType === 'EXPENSE' ? 'is-expense' : ''}`}
            >
              <ArrowDownRight className="w-4 h-4" />
              Sortie
            </button>
            <button
              type="button"
              onClick={() => {
                setNewType('REVENUE');
                setCategory('Bonus FLP');
                setFormError(null);
              }}
              className={`budget-form-toggle-btn ${newType === 'REVENUE' ? 'is-revenue' : ''}`}
            >
              <ArrowUpRight className="w-4 h-4" />
              Entrée
            </button>
          </div>

          <Input
            label="Montant (F) *"
            type="number"
            inputMode="numeric"
            min={0}
            value={amount || ''}
            onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value) || 0))}
            placeholder="ex. 15000"
            required
          />

          <Select
            label="Catégorie *"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={categoryOptions}
          />

          <Input
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />

          <Textarea
            label="Description / Notes"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="ex. Carburant pour démo et livraison produit"
            rows={2}
          />

          <div className="pt-2 flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsAddOpen(false);
                resetForm();
              }}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting}
              className="flex-1"
            >
              {editingId ? 'Enregistrer les modifications' : 'Enregistrer la transaction'}
            </Button>
          </div>
        </form>
      </Drawer>

      {/* ─── 8. Canvas imprimable (inchangé) ────────────────── */}
      <div id="report_printable_canvas" className="hidden print:block p-8 bg-white text-slate-900 space-y-6 font-sans">
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
          <div>
            <h1 className="text-2xl font-black tracking-tight uppercase">Livre de Trésorerie & Budget</h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
              Généré le {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR')}
            </p>
          </div>
          <div className="text-right">
            <h2 className="text-base font-bold leading-none">{profile.companyName || profile.name}</h2>
            <p className="text-[10px] font-bold text-amber-600 mt-1 uppercase tracking-wider italic">
              Partenaire Indépendant FLP
            </p>
          </div>
        </div>

        <div className="text-xs text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between gap-4">
          <div>
            <p className="font-extrabold text-slate-900 uppercase tracking-widest text-[9px] mb-1">
              Coordonnées du FBO
            </p>
            <p className="font-bold">{profile.name}</p>
            <p className="text-slate-500">{profile.companyAddress || 'Adresse non spécifiée'}</p>
            <p className="text-slate-500">{profile.companyPhone || 'Téléphone non spécifié'}</p>
          </div>
          {profile.fboId && (
            <div className="text-right">
              <span className="font-extrabold text-slate-400 uppercase tracking-widest text-[9px] block">
                Identifiant Forever
              </span>
              <p className="font-mono font-bold text-slate-900 text-sm mt-1">{profile.fboId}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-3 border border-slate-200 rounded-xl">
            <span className="text-[9px] font-black text-slate-400 uppercase block tracking-wider">
              Entrées (Revenus)
            </span>
            <p className="text-base font-bold text-emerald-600 mt-1 font-mono">
              +{totalRevenueAllTime.toLocaleString()} F
            </p>
          </div>
          <div className="p-3 border border-slate-200 rounded-xl">
            <span className="text-[9px] font-black text-slate-400 uppercase block tracking-wider">
              Sorties (Dépenses)
            </span>
            <p className="text-base font-bold text-red-600 mt-1 font-mono">
              −{totalExpenseAllTime.toLocaleString()} F
            </p>
          </div>
          <div className="p-3 border border-slate-200 rounded-xl bg-slate-50">
            <span className="text-[9px] font-black text-slate-500 uppercase block tracking-wider">
              Trésorerie active
            </span>
            <p className="text-base font-black text-slate-900 mt-1 font-mono">
              {(totalRevenueAllTime - totalExpenseAllTime).toLocaleString()} F
            </p>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider mb-2">
            Historique des opérations financières
          </h3>
          <table className="w-full text-left text-xs border border-slate-200">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 uppercase text-[9px] font-black text-slate-500">
                <th className="p-2.5 font-sans">Date</th>
                <th className="p-2.5 font-sans">Type</th>
                <th className="p-2.5 font-sans">Catégorie</th>
                <th className="p-2.5 font-sans">Description</th>
                <th className="p-2.5 text-right font-sans">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {budget.length > 0 ? (
                sortList(budget, budgetSort, budgetComparators).map((b, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="p-2.5 font-sans">{b.date}</td>
                    <td className={`p-2.5 font-bold ${b.type === 'REVENUE' ? 'text-emerald-500' : 'text-red-500'}`}>
                      {b.type === 'REVENUE' ? 'ENTRÉE (+)' : 'SORTIE (−)'}
                    </td>
                    <td className="p-2.5 font-sans">{b.category}</td>
                    <td className="p-2.5 font-sans text-slate-600">{b.description || b.category}</td>
                    <td className={`p-2.5 text-right font-bold ${b.type === 'REVENUE' ? 'text-emerald-500' : 'text-red-500'}`}>
                      {b.type === 'REVENUE' ? '+' : '−'}{b.amount.toLocaleString()} F
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-slate-400 italic font-sans">
                    Aucun mouvement comptable enregistré.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="text-[10px] text-slate-400 text-center pt-8 border-t border-slate-100 font-sans">
          Document imprimé via le module de gestion financière FBO — Forever Business Owner Partner.
        </div>
      </div>

    </div>
  );
};

export default BudgetView;