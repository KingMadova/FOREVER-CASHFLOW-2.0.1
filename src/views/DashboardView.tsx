import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { useStore } from '../store/useStore';
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  Layers, 
  ArrowUpRight, 
  ArrowDownRight,
  Plus, 
  Calendar,
  ChevronRight,
  TrendingDown,
  Target,
  Pencil,
  Flame,
  Zap
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as ChartTooltip, 
  ResponsiveContainer 
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { GRADES } from '../types';

export const DashboardView: React.FC = () => {
  const { orders, customers, budget, profile, updateProfile, getDailyLog, dailyLogs } = useStore();
  const navigate = useNavigate();

  // Sales Goal inputs and states
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
      monthlyGoalAmount: amt
    });
    setIsEditingGoals(false);
  };

  // Détection changement de mois : force le re-render au 1er de chaque mois
  const [currentDateRef, setCurrentDateRef] = useState(() => new Date());
  useEffect(() => {
    // Vérifie toutes les minutes si le mois a changé (app ouverte longtemps)
    const interval = setInterval(() => {
      const now = new Date();
      if (now.getMonth() !== currentDateRef.getMonth() || now.getFullYear() !== currentDateRef.getFullYear()) {
        setCurrentDateRef(now);
      }
    }, 60_000); // toutes les 60 secondes
    return () => clearInterval(interval);
  }, [currentDateRef]);

  // Get current month stats — basé sur currentDateRef pour se recaler automatiquement
  const currentMonth = currentDateRef.getMonth();
  const currentYear = currentDateRef.getFullYear();

  // Filter items in current month — utilise validatedAt pour les commandes validées
  const thisMonthOrders = orders.filter(o => {
    const dateStr = o.status === 'VALIDATED' ? (o.validatedAt || o.date) : o.date;
    const oDate = new Date(dateStr);
    return oDate.getMonth() === currentMonth && oDate.getFullYear() === currentYear;
  });

  // Calculate last month for comparison
  const lastMonthDate = new Date(currentDateRef);
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastMonth = lastMonthDate.getMonth();
  const lastYear = lastMonthDate.getFullYear();

  const lastMonthOrders = orders.filter(o => {
    const dateStr = o.status === 'VALIDATED' ? (o.validatedAt || o.date) : o.date;
    const oDate = new Date(dateStr);
    return oDate.getMonth() === lastMonth && oDate.getFullYear() === lastYear;
  });

  const totalCCThisMonth = thisMonthOrders
    .filter(o => o.status === 'VALIDATED')
    .reduce((sum, o) => sum + o.totalCC, 0);

  const totalCCLastMonth = lastMonthOrders
    .filter(o => o.status === 'VALIDATED')
    .reduce((sum, o) => sum + o.totalCC, 0);

  const totalMarginThisMonth = thisMonthOrders
    .filter(o => o.status === 'VALIDATED')
    .reduce((sum, o) => sum + o.totalMargin, 0);

  const totalMarginLastMonth = lastMonthOrders
    .filter(o => o.status === 'VALIDATED')
    .reduce((sum, o) => sum + o.totalMargin, 0);

  // Helper to calculate percentage change
  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const marginChange = calculateChange(totalMarginThisMonth, totalMarginLastMonth);
  const ccChange = calculateChange(totalCCThisMonth, totalCCLastMonth);

  const activeClientsCount = customers.filter(c => c.status === 'CLIENT').length;
  
  // Calculate expenses this month
  const thisMonthExpenses = budget
    .filter(b => b.type === 'EXPENSE')
    .filter(b => {
      const bDate = new Date(b.date);
      return bDate.getMonth() === currentMonth && bDate.getFullYear() === currentYear;
    })
    .reduce((sum, b) => sum + b.amount, 0);

  const netCashflow = totalMarginThisMonth - thisMonthExpenses;

  // Grade discount rate
  const currentGrade = GRADES.find(g => g.code === profile.grade) || GRADES[1];

  // Calculate activity for the last 7 days
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

  const chartData = last7Days.map(date => {
    const dayLabel = date.toLocaleDateString('fr-FR', { weekday: 'short' });
    const dayOrders = orders.filter(o => {
      const oDate = new Date(o.date);
      return oDate.toDateString() === date.toDateString() && o.status === 'VALIDATED';
    });

    return {
      day: dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1, 3), // e.g. "Lun"
      CC: dayOrders.reduce((sum, o) => sum + o.totalCC, 0),
      Marge: dayOrders.reduce((sum, o) => sum + o.totalMargin, 0),
      fullDate: date.toLocaleDateString()
    };
  });

  const getRecentActivities = () => {
    const combined: { id: string; name: string; type: string; desc: string; date: string; badge: string; color: string }[] = [];

    customers.slice(0, 3).forEach(c => {
      combined.push({
        id: `act-cust-${c.id}`,
        name: c.name,
        type: 'CONTACT',
        desc: c.pipelineStage === 'CONTACT_INITIATED' ? 'Contact initié' 
          : c.pipelineStage === 'PRESENTATION_DONE' ? 'Présentation effectuée'
          : c.pipelineStage === 'FOLLOW_UP_REQUIRED' ? 'Suivi requis' : 'Opportunité',
        date: c.lastContactDate,
        badge: c.status,
        color: c.status === 'CLIENT' ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/45' : 'text-amber-500 bg-amber-50 dark:bg-amber-950/45'
      });
    });

    orders.slice(0, 3).forEach(o => {
      combined.push({
        id: `act-ord-${o.id}`,
        name: o.customerName,
        type: 'COMMANDE',
        desc: `${o.items.length} produit(s) • ${o.totalCC.toFixed(3)} CC`,
        date: o.date,
        badge: o.status === 'VALIDATED' ? 'VALIDÉE' : o.status === 'PENDING' ? 'EN ATTENTE' : 'ANNULÉE',
        color: o.status === 'VALIDATED' ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950' : o.status === 'PENDING' ? 'text-amber-500 bg-amber-50 dark:bg-amber-950' : 'text-slate-400 bg-slate-100 dark:bg-slate-800'
      });
    });

    return combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 4);
  };

  const activities = getRecentActivities();

  // Widget G4 : score du jour + streak
  const todayStr = new Date().toISOString().split('T')[0];
  const todayLog = getDailyLog(todayStr);
  const checksDone = todayLog ? [
    todayLog.consumedProduct, todayLog.trained,
    todayLog.statusMorning, todayLog.statusNoon, todayLog.statusEvening
  ].filter(Boolean).length : 0;
  const countersDone = todayLog ? [
    (todayLog.contactsAdded || 0) >= 5,
    (todayLog.conversationsStarted || 0) >= 100,
  ].filter(Boolean).length : 0;
  const dayScore = checksDone + countersDone;
  const dayScorePct = Math.round((dayScore / 7) * 100);

  const streak = (() => {
    let count = 0;
    const d = new Date(todayStr + 'T00:00:00');
    while (true) {
      const ds = d.toISOString().split('T')[0];
      const l = getDailyLog(ds);
      if (!l || (!l.consumedProduct && !l.trained && !(l.contactsAdded && l.contactsAdded > 0))) break;
      count++; d.setDate(d.getDate() - 1);
    }
    return count;
  })();

  // CC du mois depuis les logs
  const nowDate = new Date();
  const monthStart = `${nowDate.getFullYear()}-${String(nowDate.getMonth()+1).padStart(2,'0')}-01`;
  const monthContacts = dailyLogs
    .filter(l => l.date >= monthStart)
    .reduce((s, l) => s + (l.contactsAdded || 0), 0);
  const monthPresentations = dailyLogs
    .filter(l => l.date >= monthStart)
    .reduce((s, l) => s + (l.oneToOne||0) + ((l.miniConferences||0)*3) + ((l.conferences||0)*5) + ((l.boutiques||0)*5), 0);

  return (
    <div className="space-y-6" id="dashboard_view_container">
      
      {/* 1. Header Greeting with profile status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#1f1f22] p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div>
          <span className="text-[10px] uppercase font-bold text-amber-500 tracking-wider">Dashboard Actif</span>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight mt-0.5">
            Bonjour, {profile.name} 👋
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Revenus optimisés et suivi de votre réseau FLP d’une seule main. Grade actuel : <strong className="text-slate-700 dark:text-slate-200">{currentGrade.label} ({Math.round(currentGrade.tauxRemise * 100)}%)</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/projection')}
            className="flex-1 md:flex-initial py-3 px-5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-2xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
            id="dash_projection_cta"
          >
            <TrendingUp className="w-4 h-4" />
            LANCER UNE PROJECTION
          </button>
          <button
            onClick={() => navigate('/orders')}
            className="py-3 px-3 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-[#2a2a2e] text-slate-700 dark:text-slate-300 rounded-2xl active:scale-95 transition-all flex items-center justify-center"
            title="Ajouter Vente"
            id="dash_add_sale_cta"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 2. KPI Grids (2x2 on Mobile, 4 columns on Desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="dashboard_kpi_grid">
        {/* KPI 1: Monthly Margin */}
        <Card className="p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between h-36">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 bg-amber-50 dark:bg-amber-950/50 text-amber-500 dark:text-amber-400 rounded-2xl flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
            {marginChange !== 0 && (
              <span className={`text-[10px] py-0.5 px-2 rounded-full font-bold flex items-center gap-0.5 ${
                marginChange > 0 ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950' : 'text-rose-500 bg-rose-50 dark:bg-rose-950'
              }`}>
                {marginChange > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {Math.abs(Math.round(marginChange))}%
              </span>
            )}
          </div>
          <div className="mt-3">
            <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Marge Mensuelle</p>
            <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1 truncate">
              {totalMarginThisMonth.toLocaleString()} <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">F</span>
            </p>
          </div>
        </Card>

        {/* KPI 2: Case Credits (CC) */}
        <Card className="p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between h-36">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-950/50 text-blue-500 dark:text-blue-400 rounded-2xl flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            {ccChange !== 0 && (
              <span className={`text-[10px] py-0.5 px-2 rounded-full font-bold flex items-center gap-0.5 ${
                ccChange > 0 ? 'text-blue-500 bg-blue-50 dark:bg-blue-950' : 'text-rose-500 bg-rose-50 dark:bg-rose-950'
              }`}>
                {ccChange > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {ccChange > 0 ? '+ ' : ''}{ccChange.toFixed(1)}%
              </span>
            )}
          </div>
          <div className="mt-3">
            <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Volume Mensuel</p>
            <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1 truncate">
              {totalCCThisMonth.toFixed(3)} <span className="text-[10px] font-bold text-blue-500 dark:text-blue-400 uppercase">CC</span>
            </p>
          </div>
        </Card>

        {/* KPI 3: Active Clients count */}
        <Card className="p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between h-36">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-500 dark:text-emerald-400 rounded-2xl flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-[10px] text-emerald-500 bg-emerald-50 dark:bg-emerald-950 py-0.5 px-2 rounded-full font-bold flex items-center gap-0.5">
              Actifs
            </span>
          </div>
          <div className="mt-3">
            <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Base Clients</p>
            <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1 truncate">
              {activeClientsCount} <span className="text-[10px] font-bold text-emerald-500 dark:text-emerald-400 uppercase">Contacts</span>
            </p>
          </div>
        </Card>

        {/* KPI 4: Net Cashflow (Margin - Expenses) */}
        <Card className="p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between h-36">
          <div className="flex items-center justify-between">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
              netCashflow >= 0 
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-500 dark:text-emerald-400' 
                : 'bg-red-50 dark:bg-red-950/50 text-red-500 dark:text-red-400'
            }`}>
              <DollarSign className="w-5 h-5" />
            </div>
            <span className={`text-[10px] py-0.5 px-2 rounded-full font-bold flex items-center ${
              netCashflow >= 0 ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950' : 'text-red-500 bg-red-50 dark:bg-red-950'
            }`}>
              {netCashflow >= 0 ? 'Positif' : 'Déficit'}
            </span>
          </div>
          <div className="mt-3">
            <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Trésorerie Nette</p>
            <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1 truncate">
              {netCashflow.toLocaleString()} <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">F</span>
            </p>
          </div>
        </Card>
      </div>

      {/* 2.5. Monthly Goals and Progress Section */}
      {(() => {
        const MONTH_NAMES = [
          'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
          'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
        ];
        const currentMonthName = MONTH_NAMES[currentMonth];

        const totalAmountThisMonth = thisMonthOrders
          .filter(o => o.status === 'VALIDATED')
          .reduce((sum, o) => sum + o.totalRetail, 0);

        const goalCC = profile.monthlyGoalCC || 0;
        const goalAmount = profile.monthlyGoalAmount || 0;

        const percentCC = goalCC > 0 ? Math.min(100, (totalCCThisMonth / goalCC) * 100) : 0;
        const percentAmount = goalAmount > 0 ? Math.min(100, (totalAmountThisMonth / goalAmount) * 100) : 0;

        return (
          <Card className="p-6 rounded-[2.5rem] border border-slate-200/80 dark:border-slate-800 shadow-sm bg-white dark:bg-[#1f1f22]" id="monthly_sales_goals_section">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center">
                  <Target className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">
                    Objectifs d'Activité • {currentMonthName} {currentYear}
                  </h3>
                  <p className="text-xs text-slate-405 dark:text-slate-500">
                    Suivez votre progression par rapport à votre objectif Case Credits (CC) ou financier de vente.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsEditingGoals(!isEditingGoals)}
                className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-[#2a2a2e] dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-center"
                id="edit_goals_btn"
              >
                <Pencil className="w-3.5 h-3.5" />
                {goalCC === 0 && goalAmount === 0 ? "Définir des objectifs" : "Modifier"}
              </button>
            </div>

            {isEditingGoals ? (
              <form onSubmit={handleSaveGoals} className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-800/80 pt-4">
                <div className="text-left">
                  <label className="block text-xs font-black uppercase text-slate-400 dark:text-slate-500 mb-1">
                    Objectif Case Credits (CC)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={goalCCInput}
                      onChange={(e) => setGoalCCInput(e.target.value)}
                      placeholder="Ex: 4.0"
                      className="w-full py-2.5 pl-3 pr-12 bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-850 rounded-xl text-slate-900 dark:text-slate-100 font-bold text-sm focus:outline-none focus:border-amber-500"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">CC</span>
                  </div>
                </div>
                <div className="text-left">
                  <label className="block text-xs font-black uppercase text-slate-400 dark:text-slate-500 mb-1">
                    Objectif de ventes (FCFA)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={goalAmountInput}
                      onChange={(e) => setGoalAmountInput(e.target.value)}
                      placeholder="Ex: 1000000"
                      className="w-full py-2.5 pl-3 pr-16 bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-850 rounded-xl text-slate-900 dark:text-slate-100 font-bold text-sm focus:outline-none focus:border-emerald-500"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">FCFA</span>
                  </div>
                </div>
                <div className="sm:col-span-2 flex items-center justify-end gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingGoals(false);
                      setGoalCCInput((profile.monthlyGoalCC || 0).toString());
                      setGoalAmountInput((profile.monthlyGoalAmount || 0).toString());
                    }}
                    className="py-2 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-705 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="py-2 px-6 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl transition-all shadow-md cursor-pointer"
                    id="save_goals_btn"
                  >
                    Enregistrer Enjeux
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-100 dark:border-slate-800/80 pt-4">
                {/* Target CC */}
                <div className="space-y-2 text-left">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <span className="text-amber-500 text-sm">🌟</span>
                      <span>Volume d'Activité CC</span>
                    </div>
                    <span className="text-slate-800 dark:text-slate-200 font-black">
                      {totalCCThisMonth.toFixed(3)} <span className="text-[10px] text-slate-400">CC</span> / <span className="text-slate-450 dark:text-slate-500">{goalCC > 0 ? `${goalCC.toFixed(1)} CC` : 'Non défini'}</span>
                    </span>
                  </div>
                  {goalCC > 0 ? (
                    <div>
                      <div className="relative w-full h-3 bg-slate-100 dark:bg-[#2a2a2e] rounded-full overflow-hidden">
                        <div 
                          className="absolute top-0 left-0 h-full bg-amber-500 rounded-full transition-all duration-500" 
                          style={{ width: `${percentCC}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                        <span>Objectif FBO Actif (4 CCs requis)</span>
                        <span className="text-amber-500 font-black">{percentCC.toFixed(0)}% atteint</span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-3 px-4 bg-slate-50 dark:bg-[#2a2a2e]/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Aucun objectif CC configuré pour ce mois.
                        <button onClick={() => setIsEditingGoals(true)} className="text-amber-500 hover:underline font-extrabold ml-1.5 cursor-pointer">Définir un objectif</button>
                      </p>
                    </div>
                  )}
                </div>

                {/* Target Amount */}
                <div className="space-y-2 text-left">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <span className="text-emerald-500 text-sm">🎯</span>
                      <span>Chiffre d'Affaires Brut (FCFA)</span>
                    </div>
                    <span className="text-slate-800 dark:text-slate-200 font-black">
                      {totalAmountThisMonth.toLocaleString()} <span className="text-[10px] text-slate-400">F</span> / <span className="text-slate-450 dark:text-slate-500">{goalAmount > 0 ? `${goalAmount.toLocaleString()} F` : 'Non défini'}</span>
                    </span>
                  </div>
                  {goalAmount > 0 ? (
                    <div>
                      <div className="relative w-full h-3 bg-slate-100 dark:bg-[#2a2a2e] rounded-full overflow-hidden">
                        <div 
                          className="absolute top-0 left-0 h-full bg-emerald-500 rounded-full transition-all duration-500" 
                          style={{ width: `${percentAmount}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                        <span>Chiffre de ventes valant chiffre d'affaire</span>
                        <span className="text-emerald-500 font-black">{percentAmount.toFixed(0)}% atteint</span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-3 px-4 bg-slate-50 dark:bg-[#2a2a2e]/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Aucun objectif financier configuré pour ce mois.
                        <button onClick={() => setIsEditingGoals(true)} className="text-emerald-500 hover:underline font-extrabold ml-1.5 cursor-pointer">Définir un objectif</button>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        );
      })()}

      {/* 3. Recharts Line Chart for Financial Performance & Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Main Chart Canvas */}
        <Card className="lg:col-span-8 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-[#1f1f22]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">Performances Hebdomadaires</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">Flux d’activité modélisé sur la semaine en cours</p>
            </div>
            
            {/* Legend switch visual (designed for thumb) */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#2a2a2e] p-1 rounded-2xl self-start">
              <span className="px-4 py-1.5 bg-white dark:bg-[#1f1f22] text-[11px] font-black text-slate-800 dark:text-slate-200 rounded-xl shadow-xs">
                Marge & CC
              </span>
            </div>
          </div>

          <div className="w-full h-56 mt-2" id="recharts_dashboard_wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMarge" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" className="dark:stroke-slate-800/60" />
                <XAxis dataKey="day" stroke="#94A3B8" fontSize={11} fontWeight="bold" tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={10} fontWeight="bold" tickLine={false} />
                <ChartTooltip 
                  contentStyle={{ 
                    backgroundColor: '#1E293B', 
                    borderRadius: '16px', 
                    color: '#fff', 
                    border: 'none',
                    fontSize: '12px'
                  }} 
                />
                <Area type="monotone" dataKey="Marge" name="Marge (F)" stroke="#F59E0B" strokeWidth={3} fillOpacity={1} fill="url(#colorMarge)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80">
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-bold">Activité de vente: {ccChange >= 0 ? '+' : ''}{ccChange.toFixed(1)}% par rapport au mois dernier</span>
            <button 
              onClick={() => navigate('/orders')}
              className="text-amber-500 dark:text-amber-400 text-xs font-bold flex items-center hover:underline"
            >
              Détails des commandes
              <ChevronRight className="w-4 h-4 ml-0.5" />
            </button>
          </div>
        </Card>

        {/* Right activities sidebar pane */}
        <div className="lg:col-span-4 flex flex-col gap-6">

          {/* Widget G4 — Journal Excellente Vie */}
          <div
            className="bg-slate-900 dark:bg-slate-800 rounded-3xl p-4 cursor-pointer active:scale-[0.99] transition-all"
            onClick={() => navigate('/tracker')}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Journal G4 · Aujourd'hui</p>
                <p className={`text-3xl font-black mt-0.5 ${dayScorePct >= 80 ? 'text-emerald-400' : dayScorePct >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                  {dayScore}<span className="text-base text-slate-500 font-bold">/7</span>
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                {streak > 0 && (
                  <div className="flex items-center gap-1 bg-orange-500/15 rounded-xl px-2.5 py-1">
                    <Flame className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-xs font-black text-orange-400">{streak}j</span>
                  </div>
                )}
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </div>
            </div>
            {/* Barre score */}
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden mb-3">
              <div
                className={`h-1.5 rounded-full transition-all duration-500 ${dayScorePct >= 80 ? 'bg-emerald-500' : dayScorePct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${dayScorePct}%` }}
              />
            </div>
            {/* Mini stats mois */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-800/60 rounded-xl p-2">
                <p className="text-[9px] text-slate-500 uppercase tracking-wider">Contacts mois</p>
                <p className="text-sm font-black text-slate-200 mt-0.5">{monthContacts}<span className="text-[10px] text-slate-500">/150</span></p>
              </div>
              <div className="bg-slate-800/60 rounded-xl p-2">
                <p className="text-[9px] text-slate-500 uppercase tracking-wider">Présentations</p>
                <p className="text-sm font-black text-slate-200 mt-0.5">{monthPresentations}<span className="text-[10px] text-slate-500">/150</span></p>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mt-2 text-center">
              {dayScorePct >= 80 ? '🔥 Journée excellente' : dayScorePct >= 50 ? '⚡ Continue à pousser' : '👆 Ouvrir le journal G4'}
            </p>
          </div>
          <Card className="flex-1 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-[#1f1f22] flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 mb-4 uppercase tracking-wider text-left">
                Activités Récentes
              </h3>
              
              <div className="space-y-4">
                {activities.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-xs text-slate-400 dark:text-slate-500">Aucune activité enregistrée.</p>
                  </div>
                ) : (
                  activities.map((act) => (
                    <div key={act.id} className="flex items-start gap-3 text-left">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50 flex flex-col items-center justify-center font-bold text-xs shrink-0 select-none">
                        <span className="text-lg">
                          {act.type === 'COMMANDE' ? '📦' : '👤'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{act.name}</h4>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 shrink-0 font-bold">{act.date}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{act.desc}</p>
                        
                        {/* Custom label for trace */}
                        <span className={`inline-block text-[8px] font-extrabold uppercase mt-1 px-1.5 py-0.5 rounded ${act.color}`}>
                          {act.badge}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              onClick={() => navigate('/clients')}
              className="mt-6 w-full py-4 border-2 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-[#2a2a2e]/60 text-slate-600 dark:text-slate-400 text-xs font-black rounded-2xl active:scale-98 transition-all"
            >
              VOIR TOUT LE RÉSEAU CLIENT
            </button>
          </Card>
        </div>

      </div>

    </div>
  );
};
