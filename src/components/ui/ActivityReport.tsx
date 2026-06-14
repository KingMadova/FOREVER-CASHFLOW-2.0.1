import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { Card } from './Card';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Award, 
  Calendar, 
  FileText, 
  Share2, 
  Briefcase, 
  Wallet, 
  ShoppingBag, 
  ArrowUpRight, 
  ArrowDownRight,
  Plus,
  Activity,
  CheckCircle,
  Copy,
  ChevronRight,
  Download,
  X,
  TableProperties
} from 'lucide-react';

export const ActivityReport: React.FC = () => {
  const { orders, budget, profile } = useStore();
  const [activeTab, setActiveTab] = useState<'monthly' | 'yearly'>('monthly');

  // Year & Month Selection
  const currentYear = new Date().getFullYear();
  const currentMonthNum = new Date().getMonth() + 1; // 1-indexed

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonthNum);
  const [copySuccess, setCopySuccess] = useState(false);

  // Custom export configurations dialog state
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportType, setExportType] = useState<'monthly' | 'yearly'>('monthly');
  const [exportYear, setExportYear] = useState<number>(currentYear);
  const [exportMonth, setExportMonth] = useState<number>(currentMonthNum);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'csv' | 'txt'>('pdf');

  // Printable Canvas dataset state (updated dynamically on download/print action)
  const [printData, setPrintData] = useState<{
    year: number;
    month: number;
    monthLabel: string;
    isYearly: boolean;
    sales: number;
    costValue: number;
    margin: number;
    cc: number;
    otherIncomes: number;
    expenses: number;
    netProfit: number;
    ordersList: any[];
    budgetList: any[];
    monthlySummaryList: any[];
  }>({
    year: currentYear,
    month: currentMonthNum,
    monthLabel: 'Janvier',
    isYearly: false,
    sales: 0,
    costValue: 0,
    margin: 0,
    cc: 0,
    otherIncomes: 0,
    expenses: 0,
    netProfit: 0,
    ordersList: [],
    budgetList: [],
    monthlySummaryList: []
  });

  // Helper lists
  const years = Array.from(new Set([
    ...orders.map(o => new Date(o.date).getFullYear()),
    ...budget.map(b => new Date(b.date).getFullYear()),
    currentYear
  ])).sort((a, b) => b - a);

  const months = [
    { value: 1, label: 'Janvier' },
    { value: 2, label: 'Février' },
    { value: 3, label: 'Mars' },
    { value: 4, label: 'Avril' },
    { value: 5, label: 'Mai' },
    { value: 6, label: 'Juin' },
    { value: 7, label: 'Juillet' },
    { value: 8, label: 'Août' },
    { value: 9, label: 'Septembre' },
    { value: 10, label: 'Octobre' },
    { value: 11, label: 'Novembre' },
    { value: 12, label: 'Décembre' }
  ];

  // Helper date parsing (returns true if order/budget is in selected month & year)
  const isDateInMonthAndYear = (dateStr: string, m: number, y: number) => {
    const d = new Date(dateStr);
    return d.getFullYear() === y && (d.getMonth() + 1) === m;
  };

  const isDateInYear = (dateStr: string, y: number) => {
    return new Date(dateStr).getFullYear() === y;
  };

  // --- MONTHLY DATA AGGREGATION ---
  const activeOrdersThisMonth = orders.filter(o => 
    o.status !== 'CANCELLED' && isDateInMonthAndYear(o.date, selectedMonth, selectedYear)
  );

  const monthlyRetailSales = activeOrdersThisMonth.reduce((acc, o) => acc + o.totalRetail, 0);
  const monthlyCostValue = activeOrdersThisMonth.reduce((acc, o) => acc + o.totalCost, 0);
  const monthlyDirectMargin = activeOrdersThisMonth.reduce((acc, o) => acc + o.totalMargin, 0);
  const monthlyCC = activeOrdersThisMonth.reduce((acc, o) => acc + o.totalCC, 0);

  // Budget entries this month
  const budgetThisMonth = budget.filter(b => isDateInMonthAndYear(b.date, selectedMonth, selectedYear));
  
  // Expenses sum
  const monthlyExpenses = budgetThisMonth
    .filter(b => b.type === 'EXPENSE')
    .reduce((acc, b) => acc + b.amount, 0);

  // Revenues from budget (excluding 'Vente Directe FBO' to prevent double counting order retail margins)
  const monthlyOtherRevenue = budgetThisMonth
    .filter(b => b.type === 'REVENUE' && b.category !== 'Vente Directe FBO')
    .reduce((acc, b) => acc + b.amount, 0);

  const monthlyNetProfit = (monthlyDirectMargin + monthlyOtherRevenue) - monthlyExpenses;

  // Group monthly expenses by category
  const monthlyExpensesByCategory = budgetThisMonth
    .filter(b => b.type === 'EXPENSE')
    .reduce((acc: { [key: string]: number }, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
      return acc;
    }, {});


  // --- YEARLY DATA AGGREGATION ---
  const activeOrdersThisYear = orders.filter(o => 
    o.status !== 'CANCELLED' && isDateInYear(o.date, selectedYear)
  );

  const yearlyRetailSales = activeOrdersThisYear.reduce((acc, o) => acc + o.totalRetail, 0);
  const yearlyDirectMargin = activeOrdersThisYear.reduce((acc, o) => acc + o.totalMargin, 0);
  const yearlyCC = activeOrdersThisYear.reduce((acc, o) => acc + o.totalCC, 0);

  const budgetThisYear = budget.filter(b => isDateInYear(b.date, selectedYear));
  const yearlyExpenses = budgetThisYear
    .filter(b => b.type === 'EXPENSE')
    .reduce((acc, b) => acc + b.amount, 0);

  const yearlyOtherRevenue = budgetThisYear
    .filter(b => b.type === 'REVENUE' && b.category !== 'Vente Directe FBO')
    .reduce((acc, b) => acc + b.amount, 0);

  const yearlyNetProfit = (yearlyDirectMargin + yearlyOtherRevenue) - yearlyExpenses;

  // Monthly table generator for Yearly view
  const monthlySummaryList = months.map(m => {
    const ordersInM = orders.filter(o => o.status !== 'CANCELLED' && isDateInMonthAndYear(o.date, m.value, selectedYear));
    const budgetInM = budget.filter(b => isDateInMonthAndYear(b.date, m.value, selectedYear));

    const sales = ordersInM.reduce((acc, o) => acc + o.totalRetail, 0);
    const margin = ordersInM.reduce((acc, o) => acc + o.totalMargin, 0);
    const ccVal = ordersInM.reduce((acc, o) => acc + o.totalCC, 0);

    const expenses = budgetInM.filter(b => b.type === 'EXPENSE').reduce((acc, b) => acc + b.amount, 0);
    const otherIncomes = budgetInM.filter(b => b.type === 'REVENUE' && b.category !== 'Vente Directe FBO').reduce((acc, b) => acc + b.amount, 0);

    const net = (margin + otherIncomes) - expenses;

    return {
      monthName: m.label,
      sales,
      margin,
      cc: ccVal,
      expenses,
      otherIncomes,
      net
    };
  });

  // Export report structure as plain text
  const handleCopyReport = () => {
    let reportText = '';
    if (activeTab === 'monthly') {
      reportText = `📊 RAPPORT MENSUEL FBO - ${months.find(m => m.value === selectedMonth)?.label.toUpperCase()} ${selectedYear}
FBO: ${profile.name} (${profile.title})
--------------------------------------------------
📈 CHIFRE D'AFFAIRES BRUT : ${monthlyRetailSales.toLocaleString()} F
🛡️ MARGE DIRECTE GÉNÉRÉE : ${monthlyDirectMargin.toLocaleString()} F
🌟 VOLUME ACTIF FLP : ${monthlyCC.toFixed(3)} CC
💸 AUTRES REVENUS (FLP/etc) : ${monthlyOtherRevenue.toLocaleString()} F
📉 DÉPENSES OPÉRATIONNELLES : ${monthlyExpenses.toLocaleString()} F
--------------------------------------------------
💰 BÉNÉFICE NET CALCULÉ : ${monthlyNetProfit.toLocaleString()} F
Statut Activité 4CC : ${monthlyCC >= 4 ? 'ACTIF FBO (Félicitations !) 🌟' : 'Actif en cours de validation (Objectif 4CC)'}
Date de génération : ${new Date().toLocaleString()}`;
    } else {
      reportText = `📊 RAPPORT ANNUEL D'ACTIVITÉ FBO - EXERCICE ${selectedYear}
FBO: ${profile.name} (${profile.title})
--------------------------------------------------
📈 VOLUME DE VENTE ANNUEL : ${yearlyRetailSales.toLocaleString()} F
🛡️ MARGE DE VENTE CUMULÉE : ${yearlyDirectMargin.toLocaleString()} F
🌟 CC TOTAL ANNUEL : ${yearlyCC.toFixed(3)} CC
💸 AUTRES BONUS FLP PERCUS : ${yearlyOtherRevenue.toLocaleString()} F
📉 FRAIS & COÛTS ANNUELS : ${yearlyExpenses.toLocaleString()} F
--------------------------------------------------
💰 RÉSULTAT NET DE L'ANNÉE : ${yearlyNetProfit.toLocaleString()} F
Moyenne mensuelle du volume : ${(yearlyCC / 12).toFixed(3)} CC / mois
Date de génération : ${new Date().toLocaleString()}`;
    }

    navigator.clipboard.writeText(reportText);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // Unified function to execute export based on modal configurations (Year, Month, Format)
  const handleExportExecute = (
    type: 'monthly' | 'yearly',
    year: number,
    month: number,
    format: 'pdf' | 'csv' | 'txt'
  ) => {
    const isYearly = type === 'yearly';
    const monthLabel = months.find(m => m.value === month)?.label || '';

    // Calculate details for specific chosen period
    const targetOrders = orders.filter(o => {
      if (o.status === 'CANCELLED') return false;
      const d = new Date(o.date);
      if (isYearly) {
        return d.getFullYear() === year;
      } else {
        return d.getFullYear() === year && (d.getMonth() + 1) === month;
      }
    });

    const targetBudget = budget.filter(b => {
      const d = new Date(b.date);
      if (isYearly) {
        return d.getFullYear() === year;
      } else {
        return d.getFullYear() === year && (d.getMonth() + 1) === month;
      }
    });

    const retailSales = targetOrders.reduce((acc, o) => acc + o.totalRetail, 0);
    const costValue = targetOrders.reduce((acc, o) => acc + o.totalCost, 0);
    const margin = targetOrders.reduce((acc, o) => acc + o.totalMargin, 0);
    const cc = targetOrders.reduce((acc, o) => acc + o.totalCC, 0);

    const expenses = targetBudget
      .filter(b => b.type === 'EXPENSE')
      .reduce((acc, b) => acc + b.amount, 0);

    const otherIncomes = targetBudget
      .filter(b => b.type === 'REVENUE' && b.category !== 'Vente Directe FBO')
      .reduce((acc, b) => acc + b.amount, 0);

    const netProfit = (margin + otherIncomes) - expenses;

    // Generate monthly list for specified Year
    const targetMonthlySummaryList = months.map(m => {
      const ordersInM = orders.filter(o => {
        if (o.status === 'CANCELLED') return false;
        const d = new Date(o.date);
        return d.getFullYear() === year && (d.getMonth() + 1) === m.value;
      });
      const budgetInM = budget.filter(b => {
        const d = new Date(b.date);
        return d.getFullYear() === year && (d.getMonth() + 1) === m.value;
      });

      const s = ordersInM.reduce((acc, o) => acc + o.totalRetail, 0);
      const mrg = ordersInM.reduce((acc, o) => acc + o.totalMargin, 0);
      const cVal = ordersInM.reduce((acc, o) => acc + o.totalCC, 0);

      const exp = budgetInM.filter(b => b.type === 'EXPENSE').reduce((acc, b) => acc + b.amount, 0);
      const other = budgetInM.filter(b => b.type === 'REVENUE' && b.category !== 'Vente Directe FBO').reduce((acc, b) => acc + b.amount, 0);
      const nProfit = (mrg + other) - exp;

      return {
        monthName: m.label,
        sales: s,
        margin: mrg,
        cc: cVal,
        expenses: exp,
        otherIncomes: other,
        net: nProfit
      };
    });

    if (format === 'txt') {
      let reportText = `==================================================
RAPPORT D'ACTIVITE FBO - ${isYearly ? `EXERCICE ${year}` : `${monthLabel.toUpperCase()} ${year}`}
FBO: ${profile.name} (${profile.title})
Date d'exportation : ${new Date().toLocaleString()}
==================================================

📈 CHIFFRE D'AFFAIRES BRUT : ${retailSales.toLocaleString()} F
🛡️ MARGE DIRECTE GENEREE : ${margin.toLocaleString()} F
🌟 VOLUME ACTIF FLP : ${cc.toFixed(3)} CC
💸 AUTRES REVENUS (FLP/etc) : ${otherIncomes.toLocaleString()} F
📉 DEPENSES OPERATIONNELLES : ${expenses.toLocaleString()} F
--------------------------------------------------
💰 BENEFICE NET CALCULE : ${netProfit.toLocaleString()} F

Statut Activite 4CC : ${cc >= 4 ? 'ACTIF FBO (Félicitations !) 🌟' : 'Actif en cours de validation (Objectif 4CC)'}

`;

      if (!isYearly) {
        reportText += `================ ENREGISTREMENTS MENSUELS ================

Commandes clients (${targetOrders.length}) :
${targetOrders.length > 0 
  ? targetOrders.map(o => ` - ${o.date} | ${o.customerName || (o as any).clientName || 'Client'} | ${o.items.length} prod(s) | ${o.totalRetail.toLocaleString()} F | ${o.totalCC.toFixed(3)} CC`).join('\n')
  : ' Aucun enregistrement.'}

Livre de Caisse / Budget :
${targetBudget.length > 0
  ? targetBudget.map(b => ` - ${b.date} | ${b.type === 'EXPENSE' ? 'Sortie' : 'Entree'} | [${b.category}] | ${b.description || 'Sans description'} | ${b.amount.toLocaleString()} F`).join('\n')
  : ' Aucun enregistrement.'}
`;
      } else {
        reportText += `================ RECAPITULATIF MOIS PAR MOIS ================

${targetMonthlySummaryList.map(m => ` - ${m.monthName.padEnd(10)} | CA: ${m.sales.toLocaleString().padStart(12)} F | CC: ${m.cc.toFixed(3).padStart(8)} CC | Marge: ${m.margin.toLocaleString().padStart(12)} F | Depenses: ${m.expenses.toLocaleString().padStart(12)} F | Net: ${m.net.toLocaleString().padStart(12)} F`).join('\n')}
`;
      }

      const fileName = isYearly 
        ? `Rapport_FBO_Annuel_${year}.txt`
        : `Rapport_FBO_Mensuel_${monthLabel}_${year}.txt`;

      const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setIsExportDialogOpen(false);

    } else if (format === 'csv') {
      let csvContent = '\uFEFF'; // Excel UTF-8 BOM
      let fileName = '';

      if (!isYearly) {
        csvContent += `Rapport Mensuel FBO;${monthLabel} ${year}\n`;
        csvContent += `Conseiller FBO;${profile.name}\n`;
        csvContent += `Grade FLP;${profile.title}\n`;
        csvContent += `Date d'exportation;${new Date().toLocaleDateString()}\n\n`;

        csvContent += `INDICATEURS CLÉS;VALEUR\n`;
        csvContent += `Chiffre d'Affaires Brut;${retailSales}\n`;
        csvContent += `Marge de Vente Directe;${margin}\n`;
        csvContent += `Volume Personnel (CC);${cc.toFixed(3)}\n`;
        csvContent += `Autres Revenus / Bonus;${otherIncomes}\n`;
        csvContent += `Frais Opérationnels / Dépenses;${expenses}\n`;
        csvContent += `Bénéfice Net;${netProfit}\n\n`;

        csvContent += `VENTES DE CE MOIS (COMMANDES)\n`;
        csvContent += `Date;Client;Statut;CC;Prix d'Achat (F);Prix Retail (F);Marge (F)\n`;
        if (targetOrders.length > 0) {
          targetOrders.forEach(o => {
            csvContent += `"${o.date}";"${o.customerName || (o as any).clientName || 'Client'}";"${o.status}";${o.totalCC.toFixed(3)};${o.totalCost};${o.totalRetail};${o.totalMargin}\n`;
          });
        } else {
          csvContent += `;;Aucune commande ce mois;;;;\n`;
        }
        csvContent += '\n';

        csvContent += `LIVRE DE CAISSE\n`;
        csvContent += `Date;Type;Catégorie;Description;Montant (F)\n`;
        if (targetBudget.length > 0) {
          targetBudget.forEach(b => {
            csvContent += `"${b.date}";"${b.type === 'EXPENSE' ? 'Sortie' : 'Entrée'}";"${b.category}";"${(b.description || '').replace(/"/g, '""')}";${b.amount}\n`;
          });
        } else {
          csvContent += `;;Aucun flux de trésorerie enregistré;;;\n`;
        }

        fileName = `Export_FBO_Mensuel_${monthLabel}_${year}.csv`;
      } else {
        csvContent += `Rapport Annuel FBO;Exercice ${year}\n`;
        csvContent += `Conseiller FBO;${profile.name}\n`;
        csvContent += `Grade FLP;${profile.title}\n`;
        csvContent += `Date d'exportation;${new Date().toLocaleDateString()}\n\n`;

        csvContent += `SYNTHÈSE FINANCIÈRE ANNUELLE\n`;
        csvContent += `Chiffre de Vente Cumulé;${retailSales}\n`;
        csvContent += `Marge de Vente Directe;${margin}\n`;
        csvContent += `Volume Cumulé (CC);${cc.toFixed(3)}\n`;
        csvContent += `Autres Bonus perçus;${otherIncomes}\n`;
        csvContent += `Frais Opérationnels Annuels;${expenses}\n`;
        csvContent += `Bénéfice Net Global;${netProfit}\n\n`;

        csvContent += `RÉCAPITULATIF MENSUEL\n`;
        csvContent += `Mois;Chiffre d'Affaires (F);CC;Marge Directe (F);Dépenses (F);Autres Revenus (F);Net FBO (F)\n`;
        targetMonthlySummaryList.forEach(m => {
          csvContent += `"${m.monthName}";${m.sales};${m.cc.toFixed(3)};${m.margin};${m.expenses};${m.otherIncomes};${m.net}\n`;
        });

        fileName = `Export_FBO_Annuel_${year}.csv`;
      }

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setIsExportDialogOpen(false);

    } else if (format === 'pdf') {
      // Setup the hidden print canvas states
      setPrintData({
        year,
        month,
        monthLabel,
        isYearly,
        sales: retailSales,
        costValue,
        margin,
        cc,
        otherIncomes,
        expenses,
        netProfit,
        ordersList: targetOrders,
        budgetList: targetBudget,
        monthlySummaryList: targetMonthlySummaryList
      });

      // Trigger standard browser print engine
      setTimeout(() => {
        window.print();
        setIsExportDialogOpen(false);
      }, 350);
    }
  };

  return (
    <Card className="p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1f1f22] space-y-6" id="activity_report_component">
      
      {/* Tab toggle and Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <Activity className="w-5 h-5 text-amber-500 animate-pulse" />
          <div>
            <h3 className="font-black text-sm text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Rapports de Performance d'Activité
            </h3>
            <p className="text-[10px] text-slate-400 font-medium">Statistiques automatiques basées sur vos ventes réelles et votre livre de caisse.</p>
          </div>
        </div>

        {/* Tab switcher buttons with elegant styling */}
        <div className="flex bg-slate-100 dark:bg-[#2a2a2e] p-1 rounded-2xl self-start sm:self-center">
          <button
            onClick={() => setActiveTab('monthly')}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
              activeTab === 'monthly'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Mensuel
          </button>
          <button
            onClick={() => setActiveTab('yearly')}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
              activeTab === 'yearly'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Annuel
          </button>
        </div>
      </div>

      {/* Selectors card section */}
      <div className="flex flex-wrap items-center gap-3 bg-[#F9F7F4] dark:bg-[#2a2a2e] p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase px-1">Année:</span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="bg-white dark:bg-[#1f1f22] border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {activeTab === 'monthly' && (
          <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-800 pl-3">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase px-1 font-sans">Mois:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="bg-white dark:bg-[#1f1f22] border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {months.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            onClick={handleCopyReport}
            className="py-1.5 px-3.5 bg-white hover:bg-slate-50 dark:bg-[#1f1f22] dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-extrabold uppercase flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
            title="Copier le résumé au format texte"
          >
            {copySuccess ? (
              <>
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                Copié !
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                Copier l'aperçu
              </>
            )}
          </button>

          <button
            onClick={() => {
              setExportType(activeTab);
              setExportYear(selectedYear);
              setExportMonth(selectedMonth);
              setIsExportDialogOpen(true);
            }}
            className="py-1.5 px-3.5 bg-amber-500 hover:bg-amber-600 border border-amber-600 text-slate-950 rounded-xl text-[10px] font-extrabold uppercase flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
            title="Configurer et exporter le rapport"
          >
            <Download className="w-3.5 h-3.5 text-slate-950" />
            Exporter le Rapport
          </button>
        </div>
      </div>

      {activeTab === 'monthly' ? (
        // ================= MONTHLY TAB WORKSPACE =================
        <div className="space-y-6">
          {/* Key Indicators grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            
            {/* Sales Volume indicator */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800/40 rounded-3xl flex items-start gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950 text-amber-500">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Chiffre d'Affaires</span>
                <p className="text-sm font-black text-slate-900 dark:text-slate-500 text-slate-100 mt-1">{monthlyRetailSales.toLocaleString()} F</p>
                <span className="text-[9px] text-slate-400 font-medium block mt-1">{activeOrdersThisMonth.length} commande(s) conclue(s)</span>
              </div>
            </div>

            {/* Direct Margin indicator */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800/40 rounded-3xl flex items-start gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500">
                <DollarSign className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Marges directes (Retail/FBO)</span>
                <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-1">{monthlyDirectMargin.toLocaleString()} F</p>
                <span className="text-[9px] text-slate-400 font-semibold block mt-1">
                  Rendement commercial: {monthlyRetailSales > 0 ? Math.round((monthlyDirectMargin / monthlyRetailSales) * 100) : 0}%
                </span>
              </div>
            </div>

            {/* FLP CC Case Credits with 4CC logic standard */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800/40 rounded-3xl flex items-start gap-3 col-span-1 sm:col-span-2 lg:col-span-1">
              <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/30 text-blue-500">
                <Award className="w-4 h-4" />
              </div>
              <div className="min-w-0 w-full">
                <div className="flex justify-between items-center w-full">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Volume Personnel FLP</span>
                  <span className={`text-[8.5px] font-black px-1.5 py-0.5 rounded-full ${
                    monthlyCC >= 4 
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400' 
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
                  }`}>
                    {monthlyCC >= 4 ? 'ACTIF ⭐' : 'OBJECTIF 4CC'}
                  </span>
                </div>
                <p className="text-sm font-black text-blue-600 dark:text-blue-400 mt-1">{monthlyCC.toFixed(3)} CC</p>
                
                {/* Visual 4CC Progress track slider */}
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full mt-2.5 overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${monthlyCC >= 4 ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-400 to-amber-500'}`}
                    style={{ width: `${Math.min(100, (monthlyCC / 4) * 100)}%` }}
                  />
                </div>
                <p className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-1.5">
                  {monthlyCC >= 4 
                    ? 'Félicitations, vous avez validé votre 4CC !' 
                    : `Manque ${(4 - monthlyCC).toFixed(3)} CC pour activer vos bonus`
                  }
                </p>
              </div>
            </div>

            {/* Other Cash Incomes */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800/40 rounded-3xl flex items-start gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950 text-amber-600">
                <ArrowUpRight className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Bonus & Autres encaissements</span>
                <p className="text-sm font-black text-slate-800 dark:text-slate-200 mt-1">{monthlyOtherRevenue.toLocaleString()} F</p>
                <span className="text-[9px] text-slate-400 font-medium block mt-1">Parrainages, bonus d'animation...</span>
              </div>
            </div>

            {/* Expenses */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800/40 rounded-3xl flex items-start gap-3">
              <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 text-rose-500">
                <ArrowDownRight className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Frais Opérationnels / Sorties</span>
                <p className="text-sm font-black text-red-500 dark:text-red-400 mt-1">-{monthlyExpenses.toLocaleString()} F</p>
                <span className="text-[9px] text-slate-400 font-medium block mt-1">Carburant, logistique, communication...</span>
              </div>
            </div>

            {/* Real net profit overall */}
            <div className="p-4 bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 rounded-3xl flex items-start gap-3 col-span-1 sm:col-span-2 lg:col-span-1">
              <div className="p-2.5 rounded-2xl bg-amber-500 text-slate-950">
                <Wallet className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider block">Bénéfice Net d'Impôt FBO</span>
                <p className="text-base font-black text-slate-900 dark:text-amber-400 mt-1">
                  {monthlyNetProfit >= 0 ? '+' : ''}{monthlyNetProfit.toLocaleString()} F
                </p>
                <span className={`text-[8.5px] font-bold ${monthlyNetProfit >= 0 ? 'text-emerald-500' : 'text-red-500'} block mt-1 uppercase`}>
                  {monthlyNetProfit >= 0 ? 'Rentable' : 'Déficit mensuel'}
                </span>
              </div>
            </div>

          </div>

          {/* Breakdown columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Expense breakdown by category */}
            <div className="p-5 border border-slate-100 dark:border-slate-800 rounded-3xl space-y-4 bg-white dark:bg-[#1a1a1d]">
              <h4 className="text-xs font-black text-slate-900 dark:text-slate-200 uppercase tracking-wider">Répartition des Sorties</h4>
              {Object.keys(monthlyExpensesByCategory).length > 0 ? (
                <div className="space-y-3.5">
                  {Object.entries(monthlyExpensesByCategory).map(([cat, val]) => {
                    const numericVal = val as number;
                    const ratio = monthlyExpenses > 0 ? (numericVal / monthlyExpenses) * 100 : 0;
                    return (
                      <div key={cat} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-bold text-slate-700 dark:text-slate-300">{cat}</span>
                          <span className="font-semibold text-slate-500">{numericVal.toLocaleString()} F ({Math.round(ratio)}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div 
                            className="bg-amber-500 h-full rounded-full transition-all duration-300" 
                            style={{ width: `${ratio}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 font-mono italic text-center py-6">Aucune dépense enregistrée sur ce mois.</p>
              )}
            </div>

            {/* Active Items this month */}
            <div className="p-5 border border-slate-100 dark:border-slate-800 rounded-3xl space-y-3 bg-white dark:bg-[#1a1a1d] flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-black text-slate-900 dark:text-slate-200 uppercase tracking-wider mb-2.5">Synthèse d'activité commerciale</h4>
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center text-xs p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                    <span className="text-slate-500 font-semibold">Taux de marge brute FBO</span>
                    <span className="font-black text-slate-900 dark:text-white">
                      {monthlyRetailSales > 0 ? Math.round((monthlyDirectMargin / monthlyRetailSales) * 100) : 0} %
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                    <span className="text-slate-500 font-semibold">Fourchette d’achat (Commande FLP)</span>
                    <span className="font-black text-slate-900 dark:text-white">{monthlyCostValue.toLocaleString()} F</span>
                  </div>
                  <div className="flex justify-between items-center text-xs p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                    <span className="text-slate-500 font-semibold">Moyenne CC par Vente</span>
                    <span className="font-black text-slate-900 dark:text-white">
                      {activeOrdersThisMonth.length > 0 ? (monthlyCC / activeOrdersThisMonth.length).toFixed(3) : '0.000'} CC / cmd
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-4 text-[10px] text-slate-400 text-center font-mono">
                Rapport de trésorerie interne • Éditable en direct
              </div>
            </div>
          </div>
        </div>
      ) : (
        // ================= YEARLY TAB WORKSPACE =================
        <div className="space-y-6">
          {/* Yearly summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 bg-slate-50 dark:bg-[#1f1f22] border border-slate-100 dark:border-slate-800 flex flex-col justify-center">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Chiffre de Vente Cumulé</span>
              <p className="text-lg font-black text-slate-850 dark:text-white mt-2">{yearlyRetailSales.toLocaleString()} F</p>
            </Card>
            <Card className="p-4 bg-slate-50 dark:bg-[#1f1f22] border border-slate-100 dark:border-slate-800 flex flex-col justify-center">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Marge Retail Totale Assurée</span>
              <p className="text-lg font-black text-emerald-500 mt-2">{yearlyDirectMargin.toLocaleString()} F</p>
            </Card>
            <Card className="p-4 bg-slate-50 dark:bg-[#1f1f22] border border-slate-100 dark:border-slate-800 flex flex-col justify-center">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Activité CC Totale</span>
              <p className="text-lg font-black text-blue-500 mt-2">{yearlyCC.toFixed(3)} CC</p>
            </Card>
            <Card className="p-4 bg-amber-500/10 dark:bg-amber-950/10 border border-amber-500/20 flex flex-col justify-center">
              <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest leading-none">Bénéfice Net Réel Annuel</span>
              <p className="text-lg font-black text-slate-900 dark:text-amber-400 mt-2">{yearlyNetProfit.toLocaleString()} F</p>
            </Card>
          </div>

          {/* Interactive Month-by-month grid mapping */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden bg-white dark:bg-[#1f1f22]">
            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
              <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">Livre Récapitulatif Mensuel ({selectedYear})</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-extrabold uppercase bg-slate-50/50 dark:bg-slate-900/20">
                    <th className="p-3.5 pl-6 font-display">Mois</th>
                    <th className="p-3.5 text-right font-sans">CA Client (F)</th>
                    <th className="p-3.5 text-right font-sans">CC Cumulés</th>
                    <th className="p-3.5 text-right font-sans">Marge Retail (F)</th>
                    <th className="p-3.5 text-right font-sans">Dépenses (F)</th>
                    <th className="p-3.5 text-right font-sans pr-6 font-display">Net FBO (F)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {monthlySummaryList.map(m => (
                    <tr 
                      key={m.monthName} 
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                        m.net > 0 ? 'text-slate-700 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <td className="p-3.5 pl-6 font-extrabold">{m.monthName}</td>
                      <td className="p-3.5 text-right font-mono font-bold">{m.sales > 0 ? m.sales.toLocaleString() : '-'}</td>
                      <td className="p-3.5 text-right font-mono font-black text-blue-500">{m.cc > 0 ? `${m.cc.toFixed(3)} CC` : '-'}</td>
                      <td className="p-3.5 text-right font-mono text-emerald-500 font-bold">{m.margin > 0 ? m.margin.toLocaleString() : '-'}</td>
                      <td className="p-3.5 text-right font-mono text-red-500">{m.expenses > 0 ? `-${m.expenses.toLocaleString()}` : '-'}</td>
                      <td className={`p-3.5 text-right font-mono font-black pr-6 ${
                        m.net > 0 ? 'text-slate-950 dark:text-amber-400' : m.net < 0 ? 'text-red-500' : 'text-slate-400'
                      }`}>
                        {m.net !== 0 ? `${m.net.toLocaleString()} F` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= OPTIONS D'EXPORTATION DIALOGUE MODAL ================= */}
      <AnimatePresence>
        {isExportDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" id="export_dialogue_modal">
            {/* Dark overlay backdrop with exit animation */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsExportDialogOpen(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />

            {/* Modal Dialog Content Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className="relative w-full max-w-lg bg-white dark:bg-[#1a1a1d] rounded-padding border border-slate-150 dark:border-slate-800 p-6 shadow-2xl space-y-6 z-10 rounded-[2rem] overflow-hidden"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/10 dark:bg-amber-500/5 text-amber-500">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                      Exporter l'activité FBO
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium">Configurez votre rapport personnalisé à télécharger.</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsExportDialogOpen(false)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 1. Configuration Period settings */}
              <div className="space-y-4">
                <span className="text-[10px] font-black text-amber-500 uppercase tracking-wider block">Période d'exportation</span>
                
                {/* Export Type selection tabs */}
                <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-[#151518] p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setExportType('monthly')}
                    className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      exportType === 'monthly'
                        ? 'bg-white dark:bg-[#1f1f22] text-slate-900 dark:text-amber-400 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                    }`}
                  >
                    Mensuelle
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportType('yearly')}
                    className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      exportType === 'yearly'
                        ? 'bg-white dark:bg-[#1f1f22] text-slate-900 dark:text-amber-400 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                    }`}
                  >
                    Annuelle
                  </button>
                </div>

                {/* Specific Year & Month selection grid */}
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Année spécifique</label>
                    <select
                      value={exportYear}
                      onChange={(e) => setExportYear(parseInt(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-[#151518] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                    >
                      {years.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>

                  <div className={`space-y-1.5 transition-opacity ${exportType === 'yearly' ? 'opacity-30 pointer-events-none' : ''}`}>
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Mois spécifique</label>
                    <select
                      value={exportMonth}
                      onChange={(e) => setExportMonth(parseInt(e.target.value))}
                      disabled={exportType === 'yearly'}
                      className="w-full bg-slate-50 dark:bg-[#151518] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                    >
                      {months.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 2. Format options with interactive buttons */}
              <div className="space-y-3">
                <span className="text-[10px] font-black text-amber-500 uppercase tracking-wider block">Format de destination</span>
                
                <div className="grid grid-cols-3 gap-2.5">
                  {/* Option PDF for Printing */}
                  <button
                    type="button"
                    onClick={() => setExportFormat('pdf')}
                    className={`p-3.5 border rounded-2xl flex flex-col items-center gap-2 transition-all text-center cursor-pointer ${
                      exportFormat === 'pdf'
                        ? 'border-amber-500 bg-amber-500/5 text-slate-900 dark:text-white'
                        : 'border-slate-150 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-[#151518] text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <FileText className="w-5 h-5 text-red-500" />
                    <div>
                      <p className="text-[11px] font-black leading-none">PDF</p>
                      <span className="text-[8.5px] font-medium text-slate-400 block mt-1 leading-none">Pour Impression</span>
                    </div>
                  </button>

                  {/* Option CSV for Analysis */}
                  <button
                    type="button"
                    onClick={() => setExportFormat('csv')}
                    className={`p-3.5 border rounded-2xl flex flex-col items-center gap-2 transition-all text-center cursor-pointer ${
                      exportFormat === 'csv'
                        ? 'border-amber-500 bg-amber-500/5 text-slate-900 dark:text-white'
                        : 'border-slate-150 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-[#151518] text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <TableProperties className="w-5 h-5 text-emerald-500" />
                    <div>
                      <p className="text-[11px] font-black leading-none">CSV</p>
                      <span className="text-[8.5px] font-medium text-slate-400 block mt-1 leading-none">Analyse Externe</span>
                    </div>
                  </button>

                  {/* Option TXT plain text */}
                  <button
                    type="button"
                    onClick={() => setExportFormat('txt')}
                    className={`p-3.5 border rounded-2xl flex flex-col items-center gap-2 transition-all text-center cursor-pointer ${
                      exportFormat === 'txt'
                        ? 'border-amber-500 bg-amber-500/5 text-slate-900 dark:text-white'
                        : 'border-slate-150 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-[#151518] text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <FileText className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-[11px] font-black leading-none">TXT</p>
                      <span className="text-[8.5px] font-medium text-slate-400 block mt-1 leading-none">Bloc-Notes</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsExportDialogOpen(false)}
                  className="flex-1 py-3 border border-slate-150 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-[#151518] text-slate-600 dark:text-slate-400 rounded-xl text-xs font-black uppercase cursor-pointer transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => handleExportExecute(exportType, exportYear, exportMonth, exportFormat)}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs uppercase cursor-pointer shadow-lg shadow-amber-500/10 transition-colors"
                >
                  Générer le Rapport
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= PHYSICAL PRINTABLE PDF CANVAS LAYOUT ================= */}
      {/* Hidden during normal browser session, displays purely when user executes PDF printable action */}
      <div id="report_printable_canvas" className="hidden print:block p-8 bg-white text-slate-900 space-y-8 font-sans">
        
        {/* Document Corporate Header */}
        <div className="flex justify-between items-center border-b border-slate-300 pb-5">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              RAPPORT DE PERFORMANCE D'ACTIVITÉ
            </h1>
            <p className="text-slate-500 text-xs mt-1">
              Statistiques officielles d'exploitation FBO
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs font-mono font-bold text-slate-400 block">ID PROJET: {profile.id || 'N/A'}</span>
            <span className="inline-block bg-amber-500/10 border border-amber-500/20 text-slate-900 font-extrabold text-[10px] uppercase tracking-widest px-2.5 py-1 rounded">
              Partenaire Forever Living Products
            </span>
          </div>
        </div>

        {/* FBO Identity Info */}
        <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 border border-slate-100 rounded-xl">
          <div>
            <span className="text-slate-400 uppercase font-bold text-[9px] block">Conseiller FBO Certifié :</span>
            <p className="font-extrabold text-sm text-slate-900 mt-1">{profile.name}</p>
            <p className="text-slate-500 mt-0.5">{profile.title}</p>
          </div>
          <div className="text-right">
            <span className="text-slate-400 uppercase font-bold text-[9px] block">Période du Rapport :</span>
            <p className="font-extrabold text-sm text-slate-900 mt-1">
              {printData.isYearly ? `Exercice Complet ${printData.year}` : `${printData.monthLabel} ${printData.year}`}
            </p>
            <p className="text-slate-400 mt-0.5 text-[10px]">Exporté le : {new Date().toLocaleDateString()}</p>
          </div>
        </div>

        {/* Financial Synthese Grid indicators */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 border border-slate-200 rounded-xl">
            <span className="text-[9px] font-black text-slate-400 uppercase block tracking-wider">Volume d'Affaires</span>
            <p className="text-xl font-bold text-slate-900 mt-1">{printData.sales.toLocaleString()} F</p>
          </div>
          <div className="p-4 border border-slate-200 rounded-xl">
            <span className="text-[9px] font-black text-slate-400 uppercase block tracking-wider">Marge Directe</span>
            <p className="text-xl font-bold text-slate-900 mt-1">{printData.margin.toLocaleString()} F</p>
          </div>
          <div className="p-4 border border-slate-200 rounded-xl">
            <span className="text-[9px] font-black text-slate-400 uppercase block tracking-wider">Volume cc</span>
            <p className="text-xl font-bold text-blue-600 mt-1">{printData.cc.toFixed(3)} CC</p>
          </div>
          <div className="p-4 border border-slate-200 rounded-xl bg-slate-50 col-span-3 flex justify-between items-center text-xs">
            <div>
              <span className="text-[9px] text-slate-400 font-bold block">Budget : Autres Revenus : {printData.otherIncomes.toLocaleString()} F  •  Sorties/Dépenses : {printData.expenses.toLocaleString()} F</span>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-bold text-slate-400 uppercase block">Bénéfice Net Global</span>
              <p className="text-lg font-black text-slate-900">{printData.netProfit.toLocaleString()} F</p>
            </div>
          </div>
        </div>

        {/* Content detail tables split between monthly vs yearly */}
        {!printData.isYearly ? (
          <div className="space-y-6">
            <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
              Détail des documents de vente
            </h4>
            <table className="w-full text-left text-xs border border-slate-200">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 uppercase text-[9px] font-black text-slate-500">
                  <th className="p-2">Date</th>
                  <th className="p-2">Client / Commande</th>
                  <th className="p-2 text-right">Volume</th>
                  <th className="p-2 text-right">Prix d'Achat</th>
                  <th className="p-2 text-right">Prix Public</th>
                  <th className="p-2 text-right">Marge Bénéficiaire</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {printData.ordersList.length > 0 ? (
                  printData.ordersList.map((o, idx) => (
                    <tr key={idx}>
                      <td className="p-2 font-mono text-[10px]">{o.date}</td>
                      <td className="p-2 font-bold">{o.customerName || (o as any).clientName || 'Client'}</td>
                      <td className="p-2 text-right font-bold text-blue-600 font-mono">{o.totalCC.toFixed(3)} CC</td>
                      <td className="p-2 text-right font-mono">{o.totalCost.toLocaleString()} F</td>
                      <td className="p-2 text-right font-mono font-bold">{o.totalRetail.toLocaleString()} F</td>
                      <td className="p-2 text-right font-mono font-bold text-emerald-600">+{o.totalMargin.toLocaleString()} F</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-slate-400 italic">Aucune commande enregistrée ce mois.</td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Cashbook Expense detailed section */}
            <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider pt-4">
              Livre de caisse et opérations budgétaires du mois
            </h4>
            <table className="w-full text-left text-xs border border-slate-200">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 uppercase text-[9px] font-black text-slate-500">
                  <th className="p-2">Date</th>
                  <th className="p-2">Sens</th>
                  <th className="p-2">Catégorie</th>
                  <th className="p-2">Description</th>
                  <th className="p-2 text-right">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {printData.budgetList.length > 0 ? (
                  printData.budgetList.map((b, idx) => (
                    <tr key={idx}>
                      <td className="p-2 font-mono text-[10px]">{b.date}</td>
                      <td className="p-2 font-bold">
                        <span className={b.type === 'EXPENSE' ? 'text-red-500' : 'text-emerald-500'}>
                          {b.type === 'EXPENSE' ? 'DÉBIT (-)' : 'CRÉDIT (+)'}
                        </span>
                      </td>
                      <td className="p-2">{b.category}</td>
                      <td className="p-2 text-slate-500">{b.description || 'N/A'}</td>
                      <td className="p-2 text-right font-bold font-mono">
                        {b.type === 'EXPENSE' ? '-' : '+'}{b.amount.toLocaleString()} F
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-slate-400 italic">Aucun flux de trésorerie enregistré ce mois.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-6">
            <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
              Récapitulatif mensuel sur l'année complète
            </h4>
            <table className="w-full text-left text-xs border border-slate-200">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 uppercase text-[9px] font-black text-slate-500 text-right">
                  <th className="p-2 text-left">Mois</th>
                  <th className="p-2">Chiffre d'Affaires</th>
                  <th className="p-2">Marge direct</th>
                  <th className="p-2">Volume CC</th>
                  <th className="p-2">Frais / Dépenses</th>
                  <th className="p-2 text-right">Rendement Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-right">
                {printData.monthlySummaryList.map((m, idx) => (
                  <tr key={idx}>
                    <td className="p-2 text-left font-black">{m.monthName}</td>
                    <td className="p-2 font-mono">{m.sales > 0 ? `${m.sales.toLocaleString()} F` : '-'}</td>
                    <td className="p-2 font-mono text-emerald-600">{m.margin > 0 ? `${m.margin.toLocaleString()} F` : '-'}</td>
                    <td className="p-2 font-mono text-blue-600 font-bold">{m.cc > 0 ? `${m.cc.toFixed(3)} CC` : '-'}</td>
                    <td className="p-2 font-mono text-red-500">{m.expenses > 0 ? `-${m.expenses.toLocaleString()} F` : '-'}</td>
                    <td className={`p-2 font-mono font-bold ${m.net >= 0 ? 'text-slate-900' : 'text-red-500'}`}>
                      {m.net.toLocaleString()} F
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Corporate seal, footnotes and signature area */}
        <div className="grid grid-cols-2 gap-4 text-xs pt-10 border-t border-slate-200">
          <div>
            <p className="font-extrabold text-slate-800">Directives d'administration</p>
            <p className="text-slate-400 text-[10px] mt-1 pr-6 leading-relaxed">
              Ce document fait office de rapport de gestion officiel d'activité FBO pour l'exercice certifié. Tout écart entre ce rapport et la facturation centralisée Forever Living devra faire l'objet d'un examen minutieux.
            </p>
          </div>
          <div className="text-right flex flex-col items-end">
            <span className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">Signature certifiée du Conseiller FBO :</span>
            <div className="w-48 h-12 border-b border-dashed border-slate-300 my-2" />
            <p className="text-slate-500 text-[9px] font-mono italic">FBO Partner, Dakar, Sénégal</p>
          </div>
        </div>

      </div>

    </Card>
  );
};
