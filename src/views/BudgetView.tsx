import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Card } from '../components/ui/Card';
import { Drawer } from '../components/ui/Drawer';
import { BudgetEntry } from '../types';
import { 
  DollarSign, 
  Plus, 
  Trash2, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  CircleDollarSign,
  Printer,
  Download
} from 'lucide-react';

export const BudgetView: React.FC = () => {
  const { budget, addBudgetEntry, deleteBudgetEntry, profile } = useStore();

  // Dialog controllers
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newType, setNewType] = useState<'REVENUE' | 'EXPENSE'>('EXPENSE');
  
  // Form fields
  const [amount, setAmount] = useState<number>(0);
  const [category, setCategory] = useState<string>('Carburant');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const totalRevenue = budget
    .filter(b => b.type === 'REVENUE')
    .reduce((sum, b) => sum + b.amount, 0);

  const totalExpense = budget
    .filter(b => b.type === 'EXPENSE')
    .reduce((sum, b) => sum + b.amount, 0);

  const netBalance = totalRevenue - totalExpense;

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      setFormError('Veuillez entrer un montant supérieur à 0.');
      return;
    }

    setFormError(null);
    addBudgetEntry({
      type: newType,
      category: category as any,
      amount,
      date,
      description
    });

    // Reset Form
    setAmount(0);
    setDescription('');
    setIsAddOpen(false);
  };

  const handleExportCSV = () => {
    // Columns headers
    const headers = ['Date', 'Type (Entree/Sortie)', 'Categorie', 'Description', 'Montant (FCFA)'];
    
    // Rows
    const rows = [...budget]
      .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map(b => [
        b.date,
        b.type === 'REVENUE' ? 'Entree' : 'Sortie',
        b.category,
        b.description || b.category,
        b.amount
      ]);
      
    // Build CSV Content
    // Excel-friendly UTF-8 BOM + semicolon-separated values
    const csvContent = "\uFEFF" + 
      [headers, ...rows]
        .map(row => row.map(val => {
          const str = String(val ?? '').replace(/"/g, '""');
          return `"${str}"`;
        }).join(';'))
        .join('\n');
        
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `tresorerie_fbo_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6" id="budget_view_container">
      
      {/* 1. Header with Add Transaction */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Livre de Trésorerie</h2>
          <p className="text-xs text-slate-500">Marge, bonus FLP, frais carburant et prospection.</p>
        </div>
        <button
          onClick={() => {
            setNewType('EXPENSE');
            setCategory('Carburant');
            setIsAddOpen(true);
          }}
          className="py-3 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-2xl active:scale-95 transition-all flex items-center gap-2 shrink-0 h-12"
          id="budget_add_btn"
        >
          <Plus className="w-4 h-4" />
          NOTER UN FRAIS / BONUS
        </button>
      </div>

      {/* 2. Top Cumulative Performance Grid cards */}
      <div className="grid grid-cols-3 gap-3" id="budget_cumulative_grid">
        {/* Total revenue */}
        <Card className="p-4 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1f1f22]">
          <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Entrées (Marge/Bonus)</span>
          <p className="text-base font-black text-emerald-500 mt-1 truncate">
            +{totalRevenue.toLocaleString()} F
          </p>
        </Card>

        {/* Total expenses */}
        <Card className="p-4 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1f1f22]">
          <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Sorties (Prospection)</span>
          <p className="text-base font-black text-red-500 mt-1 truncate">
            -{totalExpense.toLocaleString()} F
          </p>
        </Card>

        {/* Net result balance */}
        <Card className={`p-4 rounded-3xl border border-slate-200 dark:border-slate-800 bg-[#1e293b] text-white`}>
          <span className="text-[9px] font-bold text-slate-300 block uppercase tracking-wider">Trésorerie Actuelle</span>
          <p className="text-base font-black text-amber-400 mt-1 truncate">
            {netBalance.toLocaleString()} F
          </p>
        </Card>
      </div>

      {/* 3. Transaction mapping listing chronological */}
      <div className="space-y-3" id="budget_mapping_area">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-2 pt-2">
          <h3 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-left">
            Historique des Mouvements
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
              title="Exporter au format CSV (Excel)"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              Exporter Excel
            </button>
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
              title="Générer un Rapport PDF"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              Rapport PDF
            </button>
          </div>
        </div>

        {budget.length === 0 ? (
          <Card className="text-center py-10">
            <p className="text-sm text-slate-400">Aucun flux noté dans la caisse.</p>
          </Card>
        ) : (
          [...budget].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(b => (
            <Card
              key={b.id}
              className="hoverable active:scale-98 flex items-center justify-between gap-3 text-left p-4 rounded-3xl"
              id={`budget_card_${b.id}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-bold">{b.date}</span>
                  <span className="text-[8px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded py-0.5 px-2">
                    {b.category}
                  </span>
                </div>

                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs mt-1 truncate">
                  {b.description || b.category}
                </h4>
              </div>

              {/* Amount and delete key */}
              <div className="flex items-center gap-4 shrink-0">
                <span className={`font-black text-sm ${
                  b.type === 'REVENUE' ? 'text-emerald-500' : 'text-red-500'
                }`}>
                  {b.type === 'REVENUE' ? '+' : '-'}{b.amount.toLocaleString()} F
                </span>

                {deletingId === b.id ? (
                  <div className="flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-150">
                    <button
                      onClick={() => {
                        deleteBudgetEntry(b.id);
                        setDeletingId(null);
                      }}
                      className="px-2 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[10px] rounded-xl transition-all active:scale-95 cursor-pointer shadow-sm"
                      title="Confirmer la suppression"
                      id={`budget_delete_confirm_${b.id}`}
                    >
                      Supprimer ?
                    </button>
                    <button
                      onClick={() => setDeletingId(null)}
                      className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-extrabold text-[10px] rounded-xl transition-all active:scale-95 cursor-pointer"
                      title="Annuler"
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeletingId(b.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg active:scale-90 transition-all cursor-pointer"
                    title="Supprimer"
                    id={`budget_delete_${b.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

       {/* 4. DRAWER: ADD BUDGET ENTRY */}
      <Drawer
        isOpen={isAddOpen}
        onClose={() => {
          setIsAddOpen(false);
          setFormError(null);
        }}
        title={newType === 'EXPENSE' ? 'Noter une Sortie de Caisse' : 'Ajouter une Entrée de Caisse'}
      >
        <form onSubmit={handleAddSubmit} className="space-y-4">
          
          {formError && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 font-bold text-xs p-3.5 rounded-2xl">
              {formError}
            </div>
          )}

          {/* Quick toggle inside Drawer */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setNewType('EXPENSE');
                setCategory('Carburant');
                setFormError(null);
              }}
              className={`flex-1 py-3 text-xs font-bold rounded-xl border transition-all ${
                newType === 'EXPENSE'
                  ? 'bg-red-500 text-white border-red-500'
                  : 'bg-slate-50 dark:bg-[#1f1f22] text-slate-500 border-slate-200 dark:border-slate-800'
              }`}
            >
              Sortie (Frais, carburant...)
            </button>
            <button
              type="button"
              onClick={() => {
                setNewType('REVENUE');
                setCategory('Bonus FLP');
                setFormError(null);
              }}
              className={`flex-1 py-3 text-xs font-bold rounded-xl border transition-all ${
                newType === 'REVENUE'
                  ? 'bg-emerald-500 text-white border-emerald-500'
                  : 'bg-slate-50 dark:bg-[#1f1f22] text-slate-500 border-slate-200 dark:border-slate-800'
              }`}
            >
              Entrée (Bonus FLP...)
            </button>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">Montant (F) *</label>
            <input
              type="number"
              required
              value={amount || ''}
              onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value) || 0))}
              placeholder="e.g. 15000"
              className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">Catégorie *</label>
            {newType === 'EXPENSE' ? (
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white"
              >
                <option value="Carburant">Carburant (Livraison)</option>
                <option value="Logistique">Logistique / Fret FLP</option>
                <option value="Publicité">Publicité (Facebook/Instagram)</option>
                <option value="Internet">Internet (Recharges Data)</option>
                <option value="Prospection">Prospection & Espace café</option>
                <option value="Divers">Divers / Autre frais</option>
              </select>
            ) : (
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white"
              >
                <option value="Bonus FLP">Bonus réseau FLP trimestriel ou mensuel</option>
                <option value="Vente Directe FBO">Vente Directe FBO (Marge)</option>
                <option value="Autre">Autre gain</option>
              </select>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">Date</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">Description / Notes</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Carburant pour démo et livraison produit"
              className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white"
            />
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-2xl shadow-lg active:scale-95 transition-all text-sm mt-4"
          >
            ENREGISTRER LA TRANSACTION
          </button>
        </form>
      </Drawer>

      {/* 5. Hidden during normal browser session, displays purely when user executes standard PDF printable action */}
      <div id="report_printable_canvas" className="hidden print:block p-8 bg-white text-slate-900 space-y-6 font-sans">
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
          <div>
            <h1 className="text-2xl font-black tracking-tight uppercase">Livre de Trésorerie & Budget</h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Généré le {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR')}</p>
          </div>
          <div className="text-right">
            <h2 className="text-base font-bold leading-none">{profile.companyName || profile.name}</h2>
            <p className="text-[10px] font-bold text-amber-600 mt-1 uppercase tracking-wider italic">Partenaire Indépendant FLP</p>
          </div>
        </div>

        {/* FBO Details */}
        <div className="text-xs text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between gap-4">
          <div>
            <p className="font-extrabold text-slate-900 uppercase tracking-widest text-[9px] mb-1">Coordonnées du FBO</p>
            <p className="font-bold">{profile.name}</p>
            <p className="text-slate-500">{profile.companyAddress || 'Adresse non spécifiée'}</p>
            <p className="text-slate-500">{profile.companyPhone || 'Téléphone non spécifié'}</p>
          </div>
          {profile.fboId && (
            <div className="text-right">
              <span className="font-extrabold text-slate-400 uppercase tracking-widest text-[9px] block">Identifiant Forever</span>
              <p className="font-mono font-bold text-slate-900 text-sm mt-1">{profile.fboId}</p>
            </div>
          )}
        </div>

        {/* Totals Summary */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-3 border border-slate-200 rounded-xl">
            <span className="text-[9px] font-black text-slate-400 uppercase block tracking-wider">Entrées (Revenus)</span>
            <p className="text-base font-bold text-emerald-600 mt-1 font-mono">+{totalRevenue.toLocaleString()} F</p>
          </div>
          <div className="p-3 border border-slate-200 rounded-xl">
            <span className="text-[9px] font-black text-slate-400 uppercase block tracking-wider">Sorties (Dépenses)</span>
            <p className="text-base font-bold text-red-600 mt-1 font-mono">-{totalExpense.toLocaleString()} F</p>
          </div>
          <div className="p-3 border border-slate-200 rounded-xl bg-slate-50">
            <span className="text-[9px] font-black text-slate-500 uppercase block tracking-wider">Trésorerie active</span>
            <p className="text-base font-black text-slate-900 mt-1 font-mono">{netBalance.toLocaleString()} F</p>
          </div>
        </div>

        {/* Ledger table */}
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
                [...budget]
                  .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((b, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="p-2.5 font-sans">{b.date}</td>
                      <td className={`p-2.5 font-bold ${b.type === 'REVENUE' ? 'text-emerald-500' : 'text-red-500'}`}>
                        {b.type === 'REVENUE' ? 'ENTRÉE (+)' : 'SORTIE (-)'}
                      </td>
                      <td className="p-2.5 font-sans">{b.category}</td>
                      <td className="p-2.5 font-sans text-slate-600">{b.description || b.category}</td>
                      <td className={`p-2.5 text-right font-bold ${b.type === 'REVENUE' ? 'text-emerald-500' : 'text-red-500'}`}>
                        {b.type === 'REVENUE' ? '+' : '-'}{b.amount.toLocaleString()} F
                      </td>
                    </tr>
                  ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-slate-400 italic font-sans font-sans">Aucun mouvement comptable enregistré.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="text-[10px] text-slate-400 text-center pt-8 border-t border-slate-100 font-sans">
          Document imprimé via le module de gestion financière FBO - Forever Business Owner Partner.
        </div>
      </div>

    </div>
  );
};
