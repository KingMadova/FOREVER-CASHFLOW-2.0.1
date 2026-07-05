import React, { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { DailyLog } from '../types';
import {
  CheckCircle, Circle, ChevronLeft, ChevronRight,
  Flame, Target, Users, MessageCircle, Presentation,
  BookOpen, Coffee, Sun, Sunset, Moon, TrendingUp,
  Star, Award, BarChart3, Calendar
} from 'lucide-react';

// ── Constantes objectifs G4 Excellente Vie ──────────────────────
const GOALS = {
  contactsPerDay:       5,    // 150/mois ÷ 30
  conversationsPerDay:  100,
  followUpsPerDay:      5,
  // Semaine
  oneToOnePerWeek:      7,
  miniConfPerWeek:      2,
  confPerWeek:          1,
  boutiquePerWeek:      1,
  contactsPerWeek:      30,
  presentationsPerWeek: 37,   // total hebdo
  // Mois
  presentationsPerMonth: 150,
  ccSoldPerMonth:        2,
  ccPersonalPerMonth:    0.3,
  partnersPerMonth:      3,
};

const today = () => new Date().toISOString().split('T')[0];

const formatDate = (d: string) => {
  const date = new Date(d + 'T00:00:00');
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
};

const getWeekDates = (dateStr: string): string[] => {
  const date = new Date(dateStr + 'T00:00:00');
  const day = date.getDay(); // 0=dim
  const monday = new Date(date);
  monday.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split('T')[0];
  });
};

const getMonthDates = (dateStr: string): { start: string; end: string } => {
  const [y, m] = dateStr.split('-').map(Number);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
};

const Progress: React.FC<{ value: number; max: number; color?: string; size?: 'sm' | 'md' }> = ({
  value, max, color = 'bg-amber-500', size = 'md'
}) => {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  const h = size === 'sm' ? 'h-1.5' : 'h-2';
  return (
    <div className={`w-full ${h} bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden`}>
      <div
        className={`${h} ${color} rounded-full transition-all duration-500`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};

const CheckBtn: React.FC<{
  checked: boolean;
  onChange: () => void;
  label: string;
  icon: React.ReactNode;
  sub?: string;
}> = ({ checked, onChange, label, icon, sub }) => (
  <button
    onClick={onChange}
    className={`flex items-center gap-3 w-full p-3 rounded-2xl border transition-all active:scale-95 cursor-pointer text-left ${
      checked
        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700'
        : 'bg-white dark:bg-[#1f1f22] border-slate-200 dark:border-slate-800 hover:border-slate-300'
    }`}
  >
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
      checked ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
    }`}>
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className={`text-sm font-bold leading-tight ${checked ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'}`}>
        {label}
      </p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
    {checked
      ? <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
      : <Circle className="w-5 h-5 text-slate-300 shrink-0" />
    }
  </button>
);

const Counter: React.FC<{
  value: number;
  goal: number;
  label: string;
  icon: React.ReactNode;
  onInc: () => void;
  onDec: () => void;
  color?: string;
}> = ({ value, goal, label, icon, onInc, onDec, color = 'text-amber-500' }) => (
  <div className="bg-white dark:bg-[#1f1f22] border border-slate-200 dark:border-slate-800 rounded-2xl p-3">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <span className={`${color}`}>{icon}</span>
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{label}</span>
      </div>
      <span className={`text-xs font-bold ${value >= goal ? 'text-emerald-500' : 'text-slate-400'}`}>
        {value}/{goal}
      </span>
    </div>
    <Progress value={value} goal={goal} color={value >= goal ? 'bg-emerald-500' : 'bg-amber-500'} size="sm" />
    <div className="flex items-center justify-between mt-2">
      <button
        onClick={onDec}
        disabled={value === 0}
        className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold text-lg flex items-center justify-center active:scale-90 transition-all disabled:opacity-30 cursor-pointer"
      >−</button>
      <span className={`text-2xl font-black ${color}`}>{value}</span>
      <button
        onClick={onInc}
        className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 font-bold text-lg flex items-center justify-center active:scale-90 transition-all cursor-pointer"
      >+</button>
    </div>
  </div>
);

export const TrackerView: React.FC = () => {
  const { dailyLogs, getDailyLog, saveDailyLog, orders, customers } = useStore();

  const [selectedDate, setSelectedDate] = useState(today());
  const [activeTab, setActiveTab] = useState<'today' | 'week' | 'month'>('today');

  const log = getDailyLog(selectedDate) ?? {
    date: selectedDate,
    consumedProduct: false,
    trained: false,
    statusMorning: false,
    statusNoon: false,
    statusEvening: false,
    contactsAdded: 0,
    conversationsStarted: 0,
    followUpsDone: 0,
    oneToOne: 0,
    miniConferences: 0,
    conferences: 0,
    boutiques: 0,
  } as Partial<DailyLog> & { date: string };

  const patch = (fields: Partial<DailyLog>) =>
    saveDailyLog({ ...log, ...fields, date: selectedDate });

  const toggleBool = (key: keyof DailyLog) =>
    patch({ [key]: !log[key as keyof typeof log] });

  const inc = (key: keyof DailyLog) =>
    patch({ [key]: ((log[key as keyof typeof log] as number) || 0) + 1 });

  const dec = (key: keyof DailyLog) =>
    patch({ [key]: Math.max(0, ((log[key as keyof typeof log] as number) || 0) - 1) });

  const prevDay = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };
  const nextDay = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    const t = today();
    if (d.toISOString().split('T')[0] <= t)
      setSelectedDate(d.toISOString().split('T')[0]);
  };

  // Score du jour (checklist + compteurs)
  const checkScore = [
    log.consumedProduct, log.trained,
    log.statusMorning, log.statusNoon, log.statusEvening
  ].filter(Boolean).length;
  const countersDone = [
    (log.contactsAdded || 0) >= GOALS.contactsPerDay,
    (log.conversationsStarted || 0) >= GOALS.conversationsPerDay,
  ].filter(Boolean).length;
  const dayScore = checkScore + countersDone; // max 7
  const dayScorePct = Math.round((dayScore / 7) * 100);

  // Stats semaine
  const weekDates = getWeekDates(selectedDate);
  const weekLogs = weekDates.map(d => getDailyLog(d));
  const weekStats = useMemo(() => ({
    contacts:      weekLogs.reduce((s, l) => s + (l?.contactsAdded || 0), 0),
    presentations: weekLogs.reduce((s, l) => s + (l?.oneToOne || 0) + ((l?.miniConferences || 0) * 3) + ((l?.conferences || 0) * 5) + ((l?.boutiques || 0) * 5), 0),
    oneToOne:      weekLogs.reduce((s, l) => s + (l?.oneToOne || 0), 0),
    miniConf:      weekLogs.reduce((s, l) => s + (l?.miniConferences || 0), 0),
    conf:          weekLogs.reduce((s, l) => s + (l?.conferences || 0), 0),
    boutiques:     weekLogs.reduce((s, l) => s + (l?.boutiques || 0), 0),
    activeDays:    weekLogs.filter(l => l && (l.consumedProduct || l.trained || (l.contactsAdded || 0) > 0)).length,
  }), [weekLogs]);

  // Stats mois
  const { start: monthStart, end: monthEnd } = getMonthDates(selectedDate);
  const monthLogs = dailyLogs.filter(l => l.date >= monthStart && l.date <= monthEnd);
  const monthStats = useMemo(() => {
    const contacts = monthLogs.reduce((s, l) => s + (l.contactsAdded || 0), 0);
    const presentations = monthLogs.reduce((s, l) =>
      s + (l.oneToOne || 0) + ((l.miniConferences || 0) * 3) + ((l.conferences || 0) * 5) + ((l.boutiques || 0) * 5), 0);
    // CC vendus ce mois (VALIDATED orders)
    const ccSold = orders.filter(o => {
      if (o.status !== 'VALIDATED') return false;
      const d = o.validatedAt || o.date;
      return d >= monthStart && d <= monthEnd;
    }).reduce((s, o) => s + o.totalCC, 0);
    // Partenaires recrutés ce mois (prospects convertis)
    const partners = customers.filter(c => c.createdAt >= monthStart && c.createdAt <= monthEnd).length;
    return { contacts, presentations, ccSold, partners };
  }, [monthLogs, orders, customers, monthStart, monthEnd]);

  // Streak
  const streak = useMemo(() => {
    let count = 0;
    const d = new Date(today() + 'T00:00:00');
    while (true) {
      const dateStr = d.toISOString().split('T')[0];
      const l = getDailyLog(dateStr);
      if (!l || (!l.consumedProduct && !l.trained && !(l.contactsAdded && l.contactsAdded > 0))) break;
      count++;
      d.setDate(d.getDate() - 1);
    }
    return count;
  }, [dailyLogs]);

  const scoreColor = dayScorePct >= 80 ? 'text-emerald-500' : dayScorePct >= 50 ? 'text-amber-500' : 'text-red-500';
  const scoreBarColor = dayScorePct >= 80 ? 'bg-emerald-500' : dayScorePct >= 50 ? 'bg-amber-500' : 'bg-red-400';
  const isToday = selectedDate === today();

  return (
    <div className="space-y-4 pb-4" id="tracker_view_container">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-slate-100">Journal G4</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Excellente Vie · Méthode ARC</p>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-2xl px-3 py-1.5">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-black text-orange-600 dark:text-orange-400">{streak} jour{streak > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-2xl">
        {(['today', 'week', 'month'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === tab
                ? 'bg-white dark:bg-[#1f1f22] text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {tab === 'today' ? "Aujourd'hui" : tab === 'week' ? 'Semaine' : 'Mois'}
          </button>
        ))}
      </div>

      {/* ── TODAY TAB ──────────────────────────────────────── */}
      {activeTab === 'today' && (
        <>
          {/* Sélecteur de date */}
          <div className="flex items-center justify-between bg-white dark:bg-[#1f1f22] border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3">
            <button onClick={prevDay} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer active:scale-90 transition-all">
              <ChevronLeft className="w-4 h-4 text-slate-500" />
            </button>
            <div className="text-center">
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100 capitalize">{formatDate(selectedDate)}</p>
              {isToday && <p className="text-[10px] text-amber-500 font-bold">Aujourd'hui</p>}
            </div>
            <button onClick={nextDay} disabled={isToday} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer active:scale-90 transition-all disabled:opacity-30">
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          {/* Score du jour */}
          <div className="bg-slate-900 dark:bg-slate-800 rounded-3xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Score du jour</p>
                <p className={`text-4xl font-black ${scoreColor} mt-0.5`}>{dayScore}<span className="text-lg text-slate-500">/7</span></p>
              </div>
              <div className="w-14 h-14 rounded-2xl border-2 border-slate-700 flex flex-col items-center justify-center">
                <span className={`text-lg font-black ${scoreColor}`}>{dayScorePct}%</span>
              </div>
            </div>
            <Progress value={dayScore} goal={7} color={scoreBarColor} />
            <p className="text-[10px] text-slate-500 mt-2">
              {dayScorePct >= 80 ? '🔥 Journée excellente — tu avances !' : dayScorePct >= 50 ? '⚡ Bonne base, continue à pousser' : '💡 Encore des actions à faire aujourd\'hui'}
            </p>
          </div>

          {/* Checklist habitudes */}
          <div>
            <p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Habitudes du jour</p>
            <div className="space-y-2">
              <CheckBtn checked={!!log.consumedProduct} onChange={() => toggleBool('consumedProduct')}
                label="Consommation produit" icon={<Coffee className="w-4 h-4" />} sub="Minimum 0.3 CC/mois" />
              <CheckBtn checked={!!log.trained} onChange={() => toggleBool('trained')}
                label="Formation 30 min" icon={<BookOpen className="w-4 h-4" />} sub="Podcast, livre, vidéo" />
              <CheckBtn checked={!!log.statusMorning} onChange={() => toggleBool('statusMorning')}
                label="Statut WhatsApp matin" icon={<Sun className="w-4 h-4" />} sub="06h – 08h" />
              <CheckBtn checked={!!log.statusNoon} onChange={() => toggleBool('statusNoon')}
                label="Statut WhatsApp midi" icon={<Sunset className="w-4 h-4" />} sub="12h – 14h" />
              <CheckBtn checked={!!log.statusEvening} onChange={() => toggleBool('statusEvening')}
                label="Statut WhatsApp soir" icon={<Moon className="w-4 h-4" />} sub="18h – 20h" />
            </div>
          </div>

          {/* Compteurs prospection */}
          <div>
            <p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Prospection du jour</p>
            <div className="grid grid-cols-2 gap-2">
              <Counter value={log.contactsAdded || 0} goal={GOALS.contactsPerDay}
                label="Contacts ajoutés" icon={<Users className="w-3.5 h-3.5" />}
                onInc={() => inc('contactsAdded')} onDec={() => dec('contactsAdded')} />
              <Counter value={log.conversationsStarted || 0} goal={GOALS.conversationsPerDay}
                label="Conversations" icon={<MessageCircle className="w-3.5 h-3.5" />}
                onInc={() => inc('conversationsStarted')} onDec={() => dec('conversationsStarted')} />
              <Counter value={log.followUpsDone || 0} goal={GOALS.followUpsPerDay}
                label="Suivis effectués" icon={<Target className="w-3.5 h-3.5" />}
                onInc={() => inc('followUpsDone')} onDec={() => dec('followUpsDone')} />
            </div>
          </div>

          {/* Compteurs présentations */}
          <div>
            <p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Présentations du jour</p>
            <div className="grid grid-cols-2 gap-2">
              <Counter value={log.oneToOne || 0} goal={1}
                label="One-to-One" icon={<Users className="w-3.5 h-3.5" />}
                color="text-blue-500"
                onInc={() => inc('oneToOne')} onDec={() => dec('oneToOne')} />
              <Counter value={log.miniConferences || 0} goal={1}
                label="Mini-conf" icon={<Presentation className="w-3.5 h-3.5" />}
                color="text-purple-500"
                onInc={() => inc('miniConferences')} onDec={() => dec('miniConferences')} />
              <Counter value={log.conferences || 0} goal={1}
                label="Conférence" icon={<Star className="w-3.5 h-3.5" />}
                color="text-pink-500"
                onInc={() => inc('conferences')} onDec={() => dec('conferences')} />
              <Counter value={log.boutiques || 0} goal={1}
                label="Boutique à dom." icon={<Coffee className="w-3.5 h-3.5" />}
                color="text-emerald-500"
                onInc={() => inc('boutiques')} onDec={() => dec('boutiques')} />
            </div>
          </div>
        </>
      )}

      {/* ── WEEK TAB ────────────────────────────────────────── */}
      {activeTab === 'week' && (
        <>
          <div className="bg-slate-900 dark:bg-slate-800 rounded-3xl p-4 space-y-3">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Semaine en cours</p>
            {/* Grille 7 jours */}
            <div className="grid grid-cols-7 gap-1">
              {['L','M','M','J','V','S','D'].map((d, i) => (
                <div key={i} className="text-center text-[9px] text-slate-500 font-bold">{d}</div>
              ))}
              {weekDates.map((d, i) => {
                const l = getDailyLog(d);
                const score = l ? [l.consumedProduct, l.trained, l.statusMorning, l.statusNoon, l.statusEvening].filter(Boolean).length : 0;
                const isSelected = d === selectedDate;
                const isFuture = d > today();
                return (
                  <button
                    key={d}
                    onClick={() => { setSelectedDate(d); setActiveTab('today'); }}
                    disabled={isFuture}
                    className={`aspect-square rounded-xl flex flex-col items-center justify-center text-[9px] font-bold transition-all cursor-pointer active:scale-90 disabled:opacity-30 ${
                      isSelected ? 'ring-2 ring-amber-500' : ''
                    } ${
                      score >= 4 ? 'bg-emerald-500/20 text-emerald-400' :
                      score >= 2 ? 'bg-amber-500/20 text-amber-400' :
                      score >= 1 ? 'bg-slate-700 text-slate-400' :
                      'bg-slate-800 text-slate-600'
                    }`}
                  >
                    <span>{new Date(d + 'T00:00:00').getDate()}</span>
                    {score > 0 && <span className="text-[7px] mt-0.5">{score}/5</span>}
                  </button>
                );
              })}
            </div>
            <div className="text-[10px] text-slate-500 flex gap-3 flex-wrap">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500/40 inline-block" /> Excellent (4-5)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500/40 inline-block" /> Moyen (2-3)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-slate-700 inline-block" /> Démarré (1)</span>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Objectifs semaine</p>

            {[
              { label: 'Contacts ajoutés', value: weekStats.contacts, goal: GOALS.contactsPerWeek, color: 'bg-amber-500' },
              { label: 'Présentations totales', value: weekStats.presentations, goal: GOALS.presentationsPerWeek, color: 'bg-blue-500' },
              { label: 'One-to-One', value: weekStats.oneToOne, goal: GOALS.oneToOnePerWeek, color: 'bg-purple-500' },
              { label: 'Mini-conférences', value: weekStats.miniConf, goal: GOALS.miniConfPerWeek, color: 'bg-pink-500' },
              { label: 'Conférences', value: weekStats.conf, goal: GOALS.confPerWeek, color: 'bg-indigo-500' },
              { label: 'Boutiques à domicile', value: weekStats.boutiques, goal: GOALS.boutiquePerWeek, color: 'bg-emerald-500' },
            ].map(item => (
              <div key={item.label} className="bg-white dark:bg-[#1f1f22] border border-slate-200 dark:border-slate-800 rounded-2xl p-3">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{item.label}</span>
                  <span className={`text-xs font-black ${item.value >= item.goal ? 'text-emerald-500' : 'text-slate-400'}`}>
                    {item.value}/{item.goal}
                  </span>
                </div>
                <Progress value={item.value} goal={item.goal} color={item.value >= item.goal ? 'bg-emerald-500' : item.color} size="sm" />
              </div>
            ))}

            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-3 flex items-center gap-3">
              <Award className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <p className="text-xs font-black text-amber-700 dark:text-amber-400">
                  {weekStats.activeDays}/7 jours actifs cette semaine
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">Objectif : 7 jours d'action</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── MONTH TAB ───────────────────────────────────────── */}
      {activeTab === 'month' && (
        <>
          <div className="bg-slate-900 dark:bg-slate-800 rounded-3xl p-4 space-y-1.5">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-3">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </p>
            {[
              {
                label: 'Personnes présentées',
                value: monthStats.presentations,
                goal: GOALS.presentationsPerMonth,
                color: 'bg-amber-500',
                sub: `${GOALS.presentationsPerMonth} personnes/mois`
              },
              {
                label: 'Contacts ajoutés',
                value: monthStats.contacts,
                goal: 150,
                color: 'bg-blue-500',
                sub: '150 contacts/mois'
              },
              {
                label: 'CC vendus',
                value: parseFloat(monthStats.ccSold.toFixed(3)),
                goal: GOALS.ccSoldPerMonth,
                color: 'bg-emerald-500',
                sub: `${GOALS.ccSoldPerMonth} CC/mois (auto depuis commandes)`,
                decimal: true
              },
              {
                label: 'Partenaires recrutés',
                value: monthStats.partners,
                goal: GOALS.partnersPerMonth,
                color: 'bg-purple-500',
                sub: `${GOALS.partnersPerMonth} partenaires/mois (auto depuis clients)`
              },
            ].map(item => {
              const pct = Math.min(100, (item.value / item.goal) * 100);
              return (
                <div key={item.label} className="bg-slate-800/50 rounded-2xl p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-xs font-bold text-slate-200">{item.label}</p>
                      <p className="text-[9px] text-slate-500 mt-0.5">{item.sub}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-black ${pct >= 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {item.decimal ? item.value.toFixed(3) : item.value}
                      </p>
                      <p className="text-[9px] text-slate-500">/ {item.decimal ? item.goal.toFixed(1) : item.goal}</p>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-emerald-500' : item.color}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className={`text-[9px] mt-1 font-bold ${pct >= 100 ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {pct >= 100 ? '✓ Objectif atteint !' : `${Math.round(pct)}% — encore ${item.decimal ? (item.goal - item.value).toFixed(3) : (item.goal - item.value)} à faire`}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Jours actifs du mois */}
          <div className="bg-white dark:bg-[#1f1f22] border border-slate-200 dark:border-slate-800 rounded-2xl p-3">
            <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">Activité du mois</p>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: new Date(parseInt(selectedDate.split('-')[0]), parseInt(selectedDate.split('-')[1]), 0).getDate() }, (_, i) => {
                const d = `${selectedDate.split('-')[0]}-${selectedDate.split('-')[1]}-${String(i + 1).padStart(2, '0')}`;
                const l = getDailyLog(d);
                const active = l && (l.consumedProduct || l.trained || (l.contactsAdded || 0) > 0);
                const isFuture = d > today();
                return (
                  <button
                    key={d}
                    onClick={() => { setSelectedDate(d); setActiveTab('today'); }}
                    disabled={isFuture}
                    className={`aspect-square rounded-lg text-[9px] font-bold transition-all cursor-pointer active:scale-90 disabled:opacity-20 ${
                      active ? 'bg-emerald-500 text-white' :
                      isFuture ? 'bg-slate-100 dark:bg-slate-800 text-slate-300' :
                      'bg-slate-100 dark:bg-slate-800 text-slate-400'
                    }`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-500 mt-2">
              {monthLogs.filter(l => l.consumedProduct || l.trained || (l.contactsAdded || 0) > 0).length} jours actifs ce mois
            </p>
          </div>
        </>
      )}
    </div>
  );
};
