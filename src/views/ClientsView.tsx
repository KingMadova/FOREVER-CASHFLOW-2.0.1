import React, { useState, useEffect } from 'react';
import './ProspectsClients.css';
import { useNavigate } from 'react-router-dom';
import { useCustomersStore } from '../store/slices/customersSlice';
import { useProductsStore } from '../store/slices/productsSlice';
import { useOrdersStore } from '../store/slices/ordersSlice';
import { Card } from '../components/ui/Card';
import { Drawer } from '../components/ui/Drawer';
import { Customer, CustomerStatus, Order } from '../types';
import { SortSelect } from '../components/ui/SortSelect';
import { isCountedOrder, orderAccountingDate, isInMonth } from '../lib/orderStats';
import { useSortPref, sortList, cmpText, CLIENT_SORT_OPTIONS } from '../lib/sortHelper';
import { computePurchaseFollowUp, purchaseAnchorDate } from '../lib/postPurchaseService';
import { motion } from 'motion/react';
import { computeConversionStats } from '../lib/conversionService';
import { 
  Search, 
  UserPlus, 
  Phone, 
  Mail, 
  MapPin, 
  ShoppingBag, 
  Clipboard, 
  Calendar,
  Layers,
  ChevronRight,
  UserCheck,
  MessageCircle,
  Download,
  Star,
  TrendingUp,
  ChevronDown,
  Cake,
  Users,
  MapPin as MapPinIcon,
  Award,
  ThumbsUp
} from 'lucide-react';

const cleanPhoneForWhatsApp = (phoneStr: string) => {
  let cleaned = phoneStr.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }
  if (cleaned.length === 9) {
    // Congo-Brazzaville : préfixes 06 (Airtel) et 05 (MTN)
    if (cleaned.startsWith('06') || cleaned.startsWith('05') || cleaned.startsWith('04')) {
      return '242' + cleaned.substring(1);
    }
    if (cleaned.startsWith('77') || cleaned.startsWith('76') || cleaned.startsWith('78') || cleaned.startsWith('70')) {
      return '242' + cleaned;
    }
  } else if (cleaned.length === 8) {
    if (cleaned.startsWith('6') || cleaned.startsWith('5') || cleaned.startsWith('4')) {
      return '242' + cleaned;
    }
  }
  return cleaned;
};

export const ClientsView: React.FC = () => {
  const { customers, addCustomer, updateCustomer, deleteCustomer } = useCustomersStore();
  const { products } = useProductsStore();
  const { orders, updateOrder } = useOrdersStore();
  
  // States
  const [searchTerm, setSearchTerm] = useState('');
  const [activeClientView, setActiveClientView] = useState<'ALL' | 'VIP' | 'NO_ORDER'>('ALL');
  const [clientSort, setClientSort] = useSortPref('fcf-sort-clients', CLIENT_SORT_OPTIONS, 'name_asc');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Customer | null>(null);
  const [activeTab, setActiveTab] = useState<'INFO' | 'ORDERS' | 'HISTORY' | 'NOTES'>('INFO');
  useEffect(() => {
    if (sessionStorage.getItem('fcf-open-new-client') === '1') {
      sessionStorage.removeItem('fcf-open-new-client');
      setIsAddOpen(true);
    }
  }, []);


  // Période sélectionnée pour le rapport VIP
  // Recalculer la date courante dynamiquement pour détecter le changement de mois
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => {
      const n = new Date();
      setNow(prev => (n.getMonth() !== prev.getMonth() || n.getFullYear() !== prev.getFullYear()) ? n : prev);
    }, 60_000);
    return () => clearInterval(interval);
  }, []);
  const navigate = useNavigate();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1); // 1-12

  // Input states
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [newAddress, setNewAddress] = useState('');
    const [newVille, setNewVille] = useState('');
    const [newDateNaissance, setNewDateNaissance] = useState('');
    const [newSourceProspection, setNewSourceProspection] = useState<'META_ADS' | 'RECOMMANDATION' | 'BOUCHE_OREILLE' | 'EVENEMENT' | 'AUTRE'>('AUTRE');
    const [newNotes, setNewNotes] = useState('');
    const [notesSavedFeedback, setNotesSavedFeedback] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Filtering list
  const clients = customers.filter(c => c.status === CustomerStatus.CLIENT);

  const handleAddSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newName || !newPhone) return;

      addCustomer({
        name: newName,
        email: newEmail,
        phone: newPhone,
        address: newAddress,
        ville: newVille,
        dateNaissance: newDateNaissance,
        sourceProspection: newSourceProspection,
        status: CustomerStatus.CLIENT,
        pipelineStage: 'CLOSED_WON', // Won already as customer
        lastContactDate: new Date().toISOString().split('T')[0],
        notes: newNotes
      });

      // Reset Form
      setNewName('');
      setNewEmail('');
      setNewPhone('');
      setNewAddress('');
      setNewVille('');
      setNewDateNaissance('');
      setNewSourceProspection('AUTRE');
      setNewNotes('');
      setIsAddOpen(false);
    };

  // Get orders specifically for a specific client
  const getClientOrders = (clientId: string) => {
    return orders.filter(o => o.customerId === clientId);
  };

  // #6 Statut VIP : >= 3 achats valides OU >= 100 000 F cumulés
  const isVipClient = (clientId: string): boolean => {
    const validated = getClientOrders(clientId).filter(isCountedOrder);
    if (validated.length >= 3) return true;
    const total = validated.reduce((s, o) => s + o.totalRetail, 0);
    return total >= 100000;
  };

  // #4 Produits à recommander après un Clean 9 : Vital5 si pas déjà pris récemment
  const getRecommendedProductIds = (clientId: string): string[] => {
    const validated = getClientOrders(clientId)
      .filter(isCountedOrder)
      .sort((a, b) => (b.validatedAt || b.date).localeCompare(a.validatedAt || a.date));
    const tookClean9 = validated.some(o => o.items.some(i => /clean ?9/i.test(i.productName)));
    if (!tookClean9) return [];
    const tookVital5Recently = validated.slice(0, 3).some(o => o.items.some(i => /vital ?5/i.test(i.productName)));
    if (!tookVital5Recently) {
      const vital5 = products.find(pr => /vital ?5/i.test(pr.name));
      if (vital5) return [vital5.id];
    }
    return [];
  };

  const getClientTotalSpendAndCC = (clientId: string) => {
    const clientOrders = getClientOrders(clientId).filter(isCountedOrder);
    const spent = clientOrders.reduce((sum, o) => sum + o.totalRetail, 0);
    const cc = clientOrders.reduce((sum, o) => sum + o.totalCC, 0);
    return { spent, cc };
  };

  // Commandes validées d un client sur le mois selectionne
  const getClientOrdersForMonth = (clientId: string) => {
    return orders.filter(o => {
      if (!isCountedOrder(o)) return false;
      if (o.customerId !== clientId) return false;
      return isInMonth(orderAccountingDate(o), selectedYear, selectedMonth);
    });
  };

  const getClientMonthStats = (clientId: string) => {
    const monthOrders = getClientOrdersForMonth(clientId);
    const spent = monthOrders.reduce((s, o) => s + o.totalRetail, 0);
    const cc    = monthOrders.reduce((s, o) => s + o.totalCC, 0);
    const margin = monthOrders.reduce((s, o) => s + o.totalMargin, 0);
    return { spent, cc, margin, count: monthOrders.length };
  };

  // Classement VIP du mois (clients ayant au moins 1 commande validée)
  const vipRanking = clients
    .map(c => ({ client: c, ...getClientMonthStats(c.id) }))
    .filter(r => r.count > 0)
    .sort((a, b) => b.spent - a.spent);

  const isVip = (clientId: string) =>
    // Top 3 du mois OU VIP vie entière (#6 : >= 3 achats ou >= 100k F cumulés)
    (vipRanking.findIndex(r => r.client.id === clientId) < 3 && vipRanking.some(r => r.client.id === clientId)) ||
    isVipClient(clientId);

  // ── Tri de la liste clients ──
  const lastOrderDate = (clientId: string): string =>
    getClientOrders(clientId)
      .filter(isCountedOrder)
      .reduce((m, o) => { const d = o.validatedAt || o.date; return d > m ? d : m; }, '');

  const filteredClients = clients.filter(cl => {
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch = !query ||
      cl.name.toLowerCase().includes(query) ||
      cl.phone.includes(query) ||
      (cl.address || '').toLowerCase().includes(query) ||
      (cl.ville || '').toLowerCase().includes(query);
    const matchesView =
      activeClientView === 'ALL' ||
      (activeClientView === 'VIP' && isVip(cl.id)) ||
      (activeClientView === 'NO_ORDER' && !lastOrderDate(cl.id));
    return matchesSearch && matchesView;
  });
  // Clients sans commande : toujours en fin de liste
  const lastCmp = (dir: 1 | -1) => (a: Customer, b: Customer): number => {
    const da = lastOrderDate(a.id), db = lastOrderDate(b.id);
    if (!da && !db) return cmpText(a.name, b.name);
    if (!da) return 1;
    if (!db) return -1;
    return dir * da.localeCompare(db) || cmpText(a.name, b.name);
  };
  const clientComparators: Record<string, (a: Customer, b: Customer) => number> = {
    name_asc:     (a, b) => cmpText(a.name, b.name),
    name_desc:    (a, b) => cmpText(b.name, a.name),
    month_desc:   (a, b) => getClientMonthStats(b.id).spent - getClientMonthStats(a.id).spent || cmpText(a.name, b.name),
    total_desc:   (a, b) => getClientTotalSpendAndCC(b.id).spent - getClientTotalSpendAndCC(a.id).spent || cmpText(a.name, b.name),
    last_desc:    lastCmp(-1),
    last_asc:     lastCmp(1),
    created_desc: (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '') || cmpText(a.name, b.name),
    created_asc:  (a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') || cmpText(a.name, b.name),
  };
  const sortedClients = sortList(filteredClients, clientSort, clientComparators);

  const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const periodLabel = `${MONTHS_FR[selectedMonth - 1]} ${selectedYear}`;

  // Export PDF du rapport VIP via iframe isolée
  const handleExportVipPDF = () => {
    const canvas = document.getElementById('clients_vip_printable');
    if (!canvas) return;

    const clone = canvas.cloneNode(true) as HTMLElement;
    clone.style.cssText = 'display:block!important;visibility:visible!important;';

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;border:none;opacity:0;';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) { document.body.removeChild(iframe); return; }

    iframeDoc.open();
    iframeDoc.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
      <style>
        @page { margin: 12mm; size: A4 portrait; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body { margin: 0; padding: 0; background: white; color: #0f172a; font-family: Inter, ui-sans-serif, sans-serif; font-size: 12px; }
        h1 { font-size: 22px; font-weight: 900; color: #0f172a; margin: 0 0 4px; letter-spacing: -0.03em; }
        h2 { font-size: 13px; font-weight: 700; color: #0f172a; margin: 20px 0 8px; text-transform: uppercase; letter-spacing: 0.06em; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
        .header-right { text-align: right; }
        .badge { background: #f59e0b; color: #0f172a; font-weight: 800; font-size: 9px; padding: 2px 8px; border-radius: 20px; display: inline-block; text-transform: uppercase; }
        .subtitle { color: #64748b; font-size: 11px; margin: 2px 0 0; }
        .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 20px; }
        .summary-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; }
        .summary-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; }
        .summary-value { font-size: 18px; font-weight: 900; color: #0f172a; margin-top: 2px; }
        .summary-value.gold { color: #d97706; }
        .summary-value.green { color: #059669; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        thead tr { background: #0f172a; color: white; }
        thead th { padding: 8px 10px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; text-align: left; font-weight: 700; }
        tbody tr { border-bottom: 1px solid #f1f5f9; }
        tbody tr:nth-child(odd) { background: #fafafa; }
        tbody tr.vip-row { background: #fffbeb; border-left: 3px solid #f59e0b; }
        td { padding: 8px 10px; font-size: 11px; vertical-align: top; }
        .rank { font-weight: 900; color: #d97706; }
        .client-name { font-weight: 700; }
        .client-phone { color: #64748b; font-size: 10px; margin-top: 1px; }
        .orders-sub { margin-top: 8px; }
        .orders-sub-title { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 4px; letter-spacing: 0.05em; }
        .order-line { font-size: 10px; color: #475569; padding: 2px 0; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; }
        .amount { font-weight: 700; }
        .gold { color: #d97706; }
        .green { color: #059669; }
        .footer-note { font-size: 9px; color: #94a3b8; margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 8px; }
        .no-clients { text-align: center; padding: 32px; color: #94a3b8; font-size: 13px; }
      </style>
    </head><body>${clone.outerHTML}</body></html>`);
    iframeDoc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      const cleanup = () => { try { document.body.removeChild(iframe); } catch {} window.removeEventListener('afterprint', cleanup); };
      window.addEventListener('afterprint', cleanup);
      setTimeout(cleanup, 3000);
    }, 600);
  };

  const handleSaveNotes = () => {
    if (!selectedClient) return;
    updateCustomer({
      ...selectedClient,
      notes: newNotes,
      lastContactDate: new Date().toISOString().split('T')[0]
    });
    // Sync state
    setSelectedClient(prev => prev ? { ...prev, notes: newNotes } : null);
    
    setNotesSavedFeedback(true);
    setTimeout(() => {
      setNotesSavedFeedback(false);
    }, 4000);
  };

  return (
    <div className="crm-view clients-view" id="clients_view_container">
      
      {/* 1. Header with Add button */}
      <div className="crm-page-header">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Clients</h2>
            <span className="clients-total-count">{clients.length}</span>
          </div>
          <p className="text-xs text-slate-500">Portefeuille clients · suivi des achats et fidélité</p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="py-3 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-2xl active:scale-95 transition-all flex items-center gap-2 shrink-0 h-12"
          id="client_add_btn" aria-label="Ajouter un client"
        >
          <UserPlus className="w-4 h-4" />
          AJOUTER UN CLIENT
        </button>
      </div>

      {/* 2. Sélecteur de période + export VIP */}
      <div className="clients-period-toolbar flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 bg-white dark:bg-[#1f1f22] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 flex-1 min-w-0">
          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
            className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-transparent focus:outline-none cursor-pointer"
          >
            {['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'].map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-transparent focus:outline-none cursor-pointer ml-1"
          >
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {vipRanking.length > 0 && (
          <button
            onClick={handleExportVipPDF}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl active:scale-95 transition-all shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Rapport VIP PDF
          </button>
        )}
      </div>

      {/* 2b. Résumé VIP du mois (si données) */}
      {vipRanking.length > 0 && (
        <div className="clients-vip-summary bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30 rounded-2xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">{vipRanking.length} client{vipRanking.length > 1 ? 's' : ''} actif{vipRanking.length > 1 ? 's' : ''} en {periodLabel}</span>
          </div>
          <div className="flex gap-3 text-[10px] text-slate-600 dark:text-slate-400 font-medium">
            <span>CA total : <strong className="text-amber-600 dark:text-amber-400">{vipRanking.reduce((s, r) => s + r.spent, 0).toLocaleString()} F</strong></span>
            <span>•</span>
            <span>CC total : <strong className="text-blue-600 dark:text-blue-400">{vipRanking.reduce((s, r) => s + r.cc, 0).toFixed(3)} CC</strong></span>
          </div>
        </div>
      )}

      {/* Vues rapides du portefeuille client */}
      <div className="clients-saved-views" role="tablist" aria-label="Vues clients">
        {([
          ['ALL', 'Tous', clients.length],
          ['VIP', 'VIP', clients.filter(client => isVip(client.id)).length],
          ['NO_ORDER', 'Sans achat', clients.filter(client => !lastOrderDate(client.id)).length],
        ] as const).map(([view, label, count]) => (
          <button
            key={view}
            type="button"
            role="tab"
            aria-selected={activeClientView === view}
            className={activeClientView === view ? 'is-active' : ''}
            onClick={() => setActiveClientView(view)}
          >
            {label}<span>{count}</span>
          </button>
        ))}
      </div>

      {/* Recherche du portefeuille */}
      <div className="relative clients-search-wrap">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
          <Search className="w-5 h-5" />
        </span>
        <input
          type="text"
          placeholder="Rechercher par nom, téléphone, adresse..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white dark:bg-[#1f1f22] border border-slate-200 dark:border-slate-800 rounded-2xl py-3 pl-11 pr-4 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all h-12"
          id="client_search_input"
        />
      </div>

      <div className="clients-list-toolbar flex items-center justify-between gap-2">
        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">{filteredClients.length} client{filteredClients.length > 1 ? 's' : ''}</span>
        <SortSelect options={CLIENT_SORT_OPTIONS} value={clientSort} onChange={setClientSort} id="clients_sort_select" />
      </div>

      {/* Portefeuille : tableau desktop et cartes mobiles */}
      <div className="clients-results" id="clients_listing_area">
        {sortedClients.length === 0 ? (
          <Card className="clients-empty-state text-center py-10">
            <p className="text-sm text-slate-500">
              {searchTerm || activeClientView !== 'ALL'
                ? 'Aucun client ne correspond à cette vue.'
                : 'Aucun client. Ajoutez votre premier client pour commencer.'}
            </p>
            {(searchTerm || activeClientView !== 'ALL') && (
              <button type="button" onClick={() => { setSearchTerm(''); setActiveClientView('ALL'); }} className="clients-reset-filter">
                Réinitialiser les filtres
              </button>
            )}
          </Card>
        ) : (
          <>
            <div className="clients-table-wrap">
              <table className="clients-table">
                <thead>
                  <tr>
                    <th>Client</th><th>Ville</th><th>Dernier achat</th><th>Segment</th>
                    <th className="is-numeric">CA cumulé</th><th className="is-numeric">Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedClients.map(c => {
                    const { spent, cc } = getClientTotalSpendAndCC(c.id);
                    const initials = c.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                    const lastPurchase = lastOrderDate(c.id);
                    return (
                      <tr key={c.id}>
                        <td>
                          <button type="button" className="client-open-button" onClick={() => {
                            setSelectedClient(c); setNewNotes(c.notes || ''); setActiveTab('INFO'); setIsDetailOpen(true);
                          }} aria-label={'Ouvrir la fiche de ' + c.name}>
                            <span className="client-table-avatar">{initials || 'CL'}</span>
                            <span className="client-table-identity"><strong>{c.name}</strong><small>{c.phone}</small></span>
                            {c.synced === false && <span className="client-offline-dot" title="En attente de synchronisation" />}
                          </button>
                        </td>
                        <td>{c.ville || '—'}</td>
                        <td>{lastPurchase ? new Date(lastPurchase).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' }) : 'Aucun achat'}</td>
                        <td>{isVip(c.id) ? <span className="client-segment client-segment-vip"><Star size={12} /> VIP</span> : <span className="client-segment">Client</span>}</td>
                        <td className="is-numeric clients-spend">{spent.toLocaleString('fr-FR')} F</td>
                        <td className="is-numeric clients-volume">{cc.toFixed(3)} CC</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="clients-mobile-list">
              {sortedClients.map(c => {
                const { spent, cc } = getClientTotalSpendAndCC(c.id);
                const initials = c.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                const lastPurchase = lastOrderDate(c.id);
                return (
                  <Card key={c.id} className="client-mobile-row" onClick={() => {
                    setSelectedClient(c); setNewNotes(c.notes || ''); setActiveTab('INFO'); setIsDetailOpen(true);
                  }} id={'client_card_' + c.id}>
                    <span className="client-table-avatar">{initials || 'CL'}</span>
                    <span className="client-mobile-identity"><strong>{c.name}</strong><small>{lastPurchase ? 'Achat le ' + new Date(lastPurchase).toLocaleDateString('fr-FR') : 'Aucun achat enregistré'}</small></span>
                    <span className="client-mobile-metrics"><strong>{spent.toLocaleString('fr-FR')} F</strong><small>{cc.toFixed(3)} CC</small></span>
                    <ChevronRight size={17} />
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* 4. DRAWER: ADD CLIENT */}
      <Drawer isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Nouveau Client Forever">
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">Nom du client *</label>
            <input
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="ex. Marie Koumba"
              className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1">Téléphone *</label>
                        <input
                          type="tel"
                          required
                          inputMode="tel"
                          value={newPhone}
                          onChange={(e) => setNewPhone(e.target.value)}
                          placeholder="ex. +242 06 xxx xxxx"
                          className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1">E-mail</label>
                        <input
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder="ex. marie@gmail.com"
                          className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1">Ville</label>
                        <input
                          type="text"
                          value={newVille}
                          onChange={(e) => setNewVille(e.target.value)}
                          placeholder="ex. Brazzaville"
                          className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1">Date Naissance</label>
                        <input
                          type="date"
                          value={newDateNaissance}
                          onChange={(e) => setNewDateNaissance(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">Source Prospection</label>
                      <select
                        value={newSourceProspection}
                        onChange={(e) => setNewSourceProspection(e.target.value as 'META_ADS' | 'RECOMMANDATION' | 'BOUCHE_OREILLE' | 'EVENEMENT' | 'AUTRE')}
                        className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white"
                      >
                        <option value="META_ADS">📊 Meta Ads</option>
                        <option value="RECOMMANDATION">🤝 Recommandation</option>
                        <option value="BOUCHE_OREILLE">👄 Bouche-à-oreille</option>
                        <option value="EVENEMENT">🎪 Événement</option>
                        <option value="AUTRE">➕ Autre</option>
                      </select>
                    </div>

          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">Adresse de livraison</label>
            <input
              type="text"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              placeholder="ex. Quartier Tié-Tié, Pointe-Noire"
              className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">Notes / Préférences produits</label>
            <textarea
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="Achete la Pulpe Stabilisée et le Gelly de soin. Sensible au prix de groupe."
              rows={3}
              className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 text-[#101010] dark:text-white"
            />
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-2xl shadow-lg active:scale-95 transition-all text-sm mt-4"
          >
            CRÉER LA FICHE CLIENT
          </button>
        </form>
      </Drawer>

      {/* 5. DRAWER: TABS DETAILS (INFO / ORDERS / NOTES) */}
      <Drawer
        variant="side"
        isOpen={isDetailOpen && selectedClient !== null}
        onClose={() => {
          setIsDetailOpen(false);
          setShowDeleteConfirm(false);
        }}
        title={(isVipClient(selectedClient?.id || '') ? '🏆 ' : '') + (selectedClient?.name || 'Fiche Client')}
      >
        {selectedClient && (
          <div className="space-y-6">
            
            {/* Quick click-call shortcut */}
            <div className="flex gap-2">
              <a
                href={`tel:${selectedClient.phone}`}
                className="flex-1 py-3 px-2 bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-200/40 dark:border-slate-700/40"
              >
                <Phone className="w-4 h-4" />
                Appeler Client
              </a>
              <a
                href={`https://wa.me/${cleanPhoneForWhatsApp(selectedClient.phone)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:hover:bg-emerald-900 dark:text-emerald-400 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 border border-emerald-200/40 dark:border-emerald-800/20 active:scale-95 transition-all"
              >
                <MessageCircle className="w-4 h-4" />
                Écrire WhatsApp
              </a>
              <button
                type="button"
                onClick={() => {
                  // Pont vers OrdersView : client pré-sélectionné + produits recommandés
                  sessionStorage.setItem('fcf-new-order-customer', selectedClient.id);
                  const recos = getRecommendedProductIds(selectedClient.id);
                  if (recos.length > 0) {
                    sessionStorage.setItem('fcf-new-order-products', JSON.stringify(recos));
                  }
                  setIsDetailOpen(false);
                  navigate('/orders');
                }}
                className="flex-1 py-3 px-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                title={getRecommendedProductIds(selectedClient.id).length > 0 ? 'Avec recommandation pré-chargée' : 'Nouvelle commande pour ce client'}
              >
                <ShoppingBag className="w-4 h-4" />
                Passer commande
              </button>
            </div>

            {/* Tap Navigation Switches inside Drawer */}
            <div className="flex border-b border-slate-100 dark:border-slate-800 pb-2 gap-4">
              {(['INFO', 'ORDERS', 'HISTORY', 'NOTES'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`text-xs font-bold pb-2 transition-all outline-none ${
                    activeTab === tab
                      ? 'text-amber-500 border-b-2 border-amber-500'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {tab === 'INFO' ? 'Informations' : tab === 'ORDERS' ? 'Commandes' : tab === 'HISTORY' ? 'Historique' : 'Notes & Suivi'}
                </button>
              ))}
            </div>

            {/* TAB CONTENT: INFO */}
                        {activeTab === 'INFO' && (
                          <div className="space-y-4">
                            <div className="space-y-3 bg-slate-50 dark:bg-[#2a2a2e]/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-slate-400 font-bold w-20 shrink-0">Téléphone:</span>
                                <span className="text-slate-900 dark:text-slate-100 font-bold">{selectedClient.phone}</span>
                              </div>
                              {selectedClient.email && (
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="text-slate-400 font-bold w-20 shrink-0">E-mail:</span>
                                  <span className="text-slate-800 dark:text-slate-200 font-semibold">{selectedClient.email}</span>
                                </div>
                              )}
                              {selectedClient.ville && (
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="text-slate-400 font-bold w-20 shrink-0">
                                    <MapPinIcon className="w-3.5 h-3.5" /> Ville:
                                  </span>
                                  <span className="text-slate-800 dark:text-slate-200 font-semibold truncate">{selectedClient.ville}</span>
                                </div>
                              )}
                              {selectedClient.address && (
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="text-slate-400 font-bold w-20 shrink-0">Adresse:</span>
                                  <span className="text-slate-800 dark:text-slate-200 font-semibold">{selectedClient.address}</span>
                                </div>
                              )}
                              {selectedClient.dateNaissance && (
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="text-slate-400 font-bold w-20 shrink-0">
                                    <Cake className="w-3.5 h-3.5" /> Anniv.:
                                  </span>
                                  <span className="text-slate-800 dark:text-slate-200 font-semibold">{selectedClient.dateNaissance}</span>
                                </div>
                              )}
                              {selectedClient.sourceProspection && (
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="text-slate-400 font-bold w-20 shrink-0">
                                    <Users className="w-3.5 h-3.5" /> Source:
                                  </span>
                                  <span className="text-slate-800 dark:text-slate-200 font-semibold">{selectedClient.sourceProspection}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-slate-400 font-bold w-20 shrink-0">Membre depuis:</span>
                                <span className="text-slate-600 dark:text-slate-400 font-medium">{selectedClient.createdAt}</span>
                              </div>
                            </div>

                            <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 rounded-2xl">
                              <h4 className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Indicateurs de valeur</h4>
                              <div className="grid grid-cols-2 gap-4 mt-3">
                                <div>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase">Volume Total</p>
                                  <p className="text-lg font-black text-slate-900 dark:text-slate-100 mt-0.5">
                                    {getClientTotalSpendAndCC(selectedClient.id).cc.toFixed(3)} CC
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase">Chiffre d'Affaires</p>
                                  <p className="text-lg font-black text-slate-900 dark:text-slate-100 mt-0.5">
                                    {getClientTotalSpendAndCC(selectedClient.id).spent.toLocaleString()} F
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase">PV Total</p>
                                  <p className="text-lg font-black text-slate-900 dark:text-slate-100 mt-0.5">
                                    {getClientTotalSpendAndCC(selectedClient.id).cc * 135} PV
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase">BV Total</p>
                                  <p className="text-lg font-black text-slate-900 dark:text-slate-100 mt-0.5">
                                    {getClientTotalSpendAndCC(selectedClient.id).cc.toFixed(3)} BV
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

            {/* TAB CONTENT: ORDERS */}
            {activeTab === 'ORDERS' && (
              <div className="space-y-3">
                {getClientOrders(selectedClient.id).length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">Aucune commande enregistrée pour l'instant.</p>
                ) : (
                  getClientOrders(selectedClient.id).map(o => (
                    <div 
                      key={o.id} 
                      className="border border-slate-100 dark:border-slate-800 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/40 text-left flex items-center justify-between gap-2"
                    >
                      <div>
                        <span className="text-[9px] font-bold text-slate-400">{o.date}</span>
                        <p className="text-xs font-bold text-slate-950 dark:text-slate-100 mt-0.5">
                          {o.items.length} produit(s) • <span className="text-amber-500">{o.totalRetail.toLocaleString()} F</span>
                        </p>
                        <p className="text-[10px] font-semibold text-blue-500 mt-0.5">{o.totalCC.toFixed(3)} CC</p>
                      </div>
                      
                      <span className={`text-[8px] font-black uppercase tracking-wider py-1 px-2 rounded-full ${
                        o.status === 'VALIDATED' 
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400' 
                          : o.status === 'PENDING' 
                            ? 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400' 
                            : 'bg-red-50 text-red-600'
                      }`}>
                        {o.status === 'VALIDATED' ? 'VALIDÉE' : 'EN ATTENTE'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB CONTENT: HISTORY - historique achats + suivi post-achat */}
            {activeTab === 'HISTORY' && selectedClient && (() => {
              const validated = getClientOrders(selectedClient.id)
                .filter(isCountedOrder)
                .sort((a, b) => (b.validatedAt || b.date).localeCompare(a.validatedAt || a.date));
              const totalSpent = validated.reduce((s, o) => s + o.totalRetail, 0);
              const totalMargin = validated.reduce((s, o) => s + o.totalMargin, 0);
              return (
                <div className="space-y-4">
                  {/* Synthèse vie client */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-3 text-white shadow-sm">
                      <p className="text-[8px] font-black uppercase tracking-wider opacity-80">Achats</p>
                      <p className="text-lg font-black leading-tight">{validated.length}</p>
                    </div>
                    <div className="bg-slate-900 dark:bg-[#1a1a1d] rounded-2xl p-3 text-white">
                      <p className="text-[8px] font-black uppercase tracking-wider text-slate-400">CA Total</p>
                      <p className="text-base font-black text-amber-400">{totalSpent.toLocaleString()} F</p>
                    </div>
                    <div className="bg-emerald-600 rounded-2xl p-3 text-white shadow-sm">
                      <p className="text-[8px] font-black uppercase tracking-wider opacity-75">Ma marge</p>
                      <p className="text-base font-black">{totalMargin.toLocaleString()} F</p>
                    </div>
                  </div>

                  {validated.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-xs text-slate-400">Aucun achat validé pour l'instant.</p>
                      <p className="text-[10px] text-slate-400/70 mt-1">L'historique et le suivi post-achat s'afficheront après la première vente.</p>
                    </div>
                  ) : (
                    /* Timeline verticale : chaque achat avec son suivi J+N */
                    <div className="relative pl-6 space-y-5">
                      <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-amber-400 via-slate-300 to-transparent dark:via-slate-700" />
                      {validated.map(o => {
                        const fu = computePurchaseFollowUp(o, customers);
                        const anchor = purchaseAnchorDate(o);
                        const milestones = [
                          { key: 'J0', label: 'Achat', dayOffset: 0, done: true },
                          { key: 'J+3', label: 'Démarrage produit', dayOffset: 3 },
                          { key: 'J+7', label: 'Satisfaction', dayOffset: 7 },
                          { key: 'J+10', label: 'Réachat', dayOffset: 10 },
                        ];
                        return (
                          <motion.div
                            key={o.id}
                            className="relative"
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, delay: 0.05 }}
                          >
                            {/* Point sur la timeline */}
                            <div className={`absolute -left-6 top-1 w-[19px] h-[19px] rounded-full border-2 border-white dark:border-[#1f1f22] ${
                              fu.milestone === 'DONE' ? 'bg-slate-300 dark:bg-slate-600' : 'bg-amber-500'
                            }`} />
                            <div className="border border-slate-200/60 dark:border-slate-800 rounded-2xl p-3 bg-white dark:bg-[#232326]">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className="text-[10px] font-bold text-slate-500">
                                  🧾 {o.refCommande || '—'} · {anchor}
                                </span>
                                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                                  {fu.daysSince <= 14 ? `J+${fu.daysSince}` : 'clôturé'}
                                </span>
                              </div>
                              <p className="text-xs font-black text-slate-900 dark:text-slate-100 mt-1">
                                {o.items.length} produit(s) · <span className="text-amber-600 dark:text-amber-400">{o.totalRetail.toLocaleString()} F</span>
                              </p>

                              {/* Jalons de suivi */}
                              <div className="grid grid-cols-4 gap-1.5 mt-2.5">
                                {milestones.map(m => {
                                  const reached = fu.daysSince >= m.dayOffset;
                                  const isCurrent = !reached && m.dayOffset - fu.daysSince === 1;
                                  const isActiveWindow = fu.daysSince >= m.dayOffset && fu.daysSince <= m.dayOffset + 3;
                                  const color =
                                    m.key === 'J0' || reached
                                      ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-900'
                                      : isCurrent
                                        ? 'bg-amber-500 text-white border-amber-500 animate-pulse'
                                        : isActiveWindow
                                          ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200/60 dark:border-amber-900'
                                          : 'bg-slate-50 dark:bg-slate-800/50 text-slate-400 border-slate-200/60 dark:border-slate-700';
                                  return (
                                    <div key={m.key} className={`rounded-lg border px-1 py-1.5 text-center ${color}`}>
                                      <p className="text-[9px] font-black">{m.key}</p>
                                      <p className="text-[7px] font-bold leading-tight truncate">{m.label}</p>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Conseil du moment */}
                              {fu.urgency !== 'done' && (
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 italic leading-snug">
                                  💡 {fu.title} : {fu.message}
                                </p>
                              )}

                              {/* #1 Notation satisfaction au jalon J+7 */}
                              {fu.daysSince >= 5 && fu.daysSince <= 14 && (
                                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">
                                    Satisfaction client {o.satisfactionLevel ? '·' : '(à noter)'}
                                  </p>
                                  <div className="flex items-center gap-1.5">
                                    {([
                                      { level: 'LOW', emoji: '😞', label: 'Déçu', on: 'bg-rose-100 text-rose-600 ring-rose-300' },
                                      { level: 'MID', emoji: '😐', label: 'Moyen', on: 'bg-amber-100 text-amber-600 ring-amber-300' },
                                      { level: 'HIGH', emoji: '😍', label: 'Ravi', on: 'bg-emerald-100 text-emerald-600 ring-emerald-300' },
                                    ] as const).map(opt => {
                                      const selected = o.satisfactionLevel === opt.level;
                                      return (
                                        <button
                                          key={opt.level}
                                          onClick={async () => {
                                            // Note 1-5 et niveau LOW/MID/HIGH restent synchronisés
                                            const levelToStars: Record<string, 1 | 2 | 3 | 4 | 5> = { LOW: 1, MID: 3, HIGH: 5 };
                                            await updateOrder({
                                              ...o,
                                              satisfactionLevel: selected ? undefined : opt.level,
                                              satisfaction: selected ? undefined : levelToStars[opt.level],
                                              satisfactionDate: new Date().toISOString(),
                                            });
                                          }}
                                          className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer active:scale-95 ring-1 ${
                                            selected ? `${opt.on} font-black` : 'bg-slate-50 dark:bg-slate-800/50 text-slate-400 ring-transparent hover:ring-slate-200'
                                          }`}
                                          title={`Noter : ${opt.label}`}
                                        >
                                          {opt.emoji} {opt.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}

                  {/* #3 Stats réachat & satisfaction (global, calculé sur tous les clients) */}
                  {(() => {
                    const cs = computeConversionStats(orders, customers);
                    if (cs.totalValidated < 2) return null;
                    return (
                      <div className="bg-slate-900 dark:bg-[#161619] rounded-2xl p-4 mt-2">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                          📈 Performance réseau (tous clients)
                        </h4>
                        <div className="grid grid-cols-2 gap-2.5 text-center">
                          <div className="bg-white/5 rounded-xl py-2.5">
                            <p className="text-lg font-black text-emerald-400">{cs.conversionRate}%</p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Taux de réachat</p>
                          </div>
                          <div className="bg-white/5 rounded-xl py-2.5">
                            <p className="text-lg font-black text-amber-400">{cs.clean9ToVital5Rate}%</p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Clean 9 → Vital5</p>
                          </div>
                          <div className="bg-white/5 rounded-xl py-2.5">
                            <p className="text-sm font-black text-white">{cs.repeatCustomers}</p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Clients fidèles</p>
                          </div>
                          <div className="bg-white/5 rounded-xl py-2.5">
                            <p className="text-sm font-black text-white">{cs.avgOrdersPerCustomer}</p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Achats / client</p>
                          </div>
                        </div>
                        {(cs.satisfactionBreakdown.LOW + cs.satisfactionBreakdown.MID + cs.satisfactionBreakdown.HIGH) > 0 && (
                          <div className="mt-3 pt-3 border-t border-white/10">
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Satisfactions notées</p>
                            <div className="flex gap-2">
                              <span className="text-[10px] font-bold bg-rose-500/15 text-rose-300 px-2 py-1 rounded-lg">😞 {cs.satisfactionBreakdown.LOW}</span>
                              <span className="text-[10px] font-bold bg-amber-500/15 text-amber-300 px-2 py-1 rounded-lg">😐 {cs.satisfactionBreakdown.MID}</span>
                              <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-300 px-2 py-1 rounded-lg">😍 {cs.satisfactionBreakdown.HIGH}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })()}

            {/* TAB CONTENT: NOTES */}
            {activeTab === 'NOTES' && (
              <div className="space-y-4">
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Enregistrer des notes de suivi pour ce client..."
                  rows={4}
                  className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white"
                />

                {notesSavedFeedback && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 font-extrabold text-[11px] p-3 rounded-xl text-center">
                    ✓ Notes sauvegardées avec succès !
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSaveNotes}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  METTRE À JOUR NOTES CLIENT
                </button>
              </div>
            )}

            {/* Detached delete action */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              {showDeleteConfirm ? (
                <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl space-y-3 animate-in fade-in zoom-in-95 duration-150">
                  <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 text-left leading-relaxed">
                    Voulez-vous vraiment supprimer définitivement ce client de votre base ? Cette action est définitive.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        deleteCustomer(selectedClient.id);
                        setIsDetailOpen(false);
                        setShowDeleteConfirm(false);
                      }}
                      className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl active:scale-95 transition-all text-center cursor-pointer shadow-sm"
                    >
                      Oui, Supprimer
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="py-2 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl active:scale-95 transition-all text-center cursor-pointer"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full py-3 bg-red-50 dark:bg-red-950/20 text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-950/40 text-xs font-bold rounded-xl active:scale-95 transition-all text-center border border-red-200/50 dark:border-red-900/30 cursor-pointer"
                >
                  Supprimer de la Base Client FLP
                </button>
              )}
            </div>

          </div>
        )}
      </Drawer>

      {/* Canvas imprimable VIP — caché, utilisé uniquement pour l export PDF */}
      <div id="clients_vip_printable" style={{ display: 'none' }}>
        <div className="header">
          <div>
            <h1>Rapport Clientèle VIP</h1>
            <p className="subtitle">Période : {periodLabel} · {vipRanking.length} client(s) actif(s)</p>
          </div>
          <div className="header-right">
            <div className="badge">Forever CashFlow · Les Conquérants</div>
            <p className="subtitle" style={{ marginTop: 4 }}>Généré le {new Date().toLocaleDateString('fr-FR')}</p>
          </div>
        </div>

        {/* Résumé global */}
        <div className="summary-grid">
          <div className="summary-card">
            <div className="summary-label">CA Total période</div>
            <div className="summary-value gold">{vipRanking.reduce((s, r) => s + r.spent, 0).toLocaleString()} F</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Marge Directe</div>
            <div className="summary-value green">+{vipRanking.reduce((s, r) => s + r.margin, 0).toLocaleString()} F</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Volume CC</div>
            <div className="summary-value">{vipRanking.reduce((s, r) => s + r.cc, 0).toFixed(3)} CC</div>
          </div>
        </div>

        {/* Classement détaillé */}
        {vipRanking.length === 0 ? (
          <div className="no-clients">Aucun client avec commande validée sur cette période.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 30 }}>#</th>
                <th>Client</th>
                <th style={{ textAlign: 'right' }}>CA (F)</th>
                <th style={{ textAlign: 'right' }}>Marge (F)</th>
                <th style={{ textAlign: 'right' }}>CC</th>
                <th style={{ textAlign: 'right' }}>Cmds</th>
              </tr>
            </thead>
            <tbody>
              {vipRanking.map((r, idx) => (
                <tr key={r.client.id} className={idx < 3 ? 'vip-row' : ''}>
                  <td><span className="rank">{idx + 1}{idx < 3 ? ' ⭐' : ''}</span></td>
                  <td>
                    <div className="client-name">{r.client.name}</div>
                    <div className="client-phone">{r.client.phone}</div>
                    {/* Détail commandes du mois */}
                    {getClientOrdersForMonth(r.client.id).length > 0 && (
                      <div className="orders-sub">
                        <div className="orders-sub-title">Commandes du mois</div>
                        {getClientOrdersForMonth(r.client.id).map(o => (
                          <div key={o.id} className="order-line">
                            <span>{o.validatedAt || o.date} · {o.items.map(i => i.productName).join(', ')}</span>
                            <span className="amount gold">{o.totalRetail.toLocaleString()} F</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}><span className="amount gold">{r.spent.toLocaleString()}</span></td>
                  <td style={{ textAlign: 'right' }}><span className="amount green">+{r.margin.toLocaleString()}</span></td>
                  <td style={{ textAlign: 'right' }}>{r.cc.toFixed(3)}</td>
                  <td style={{ textAlign: 'right' }}>{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Clients sans commande ce mois */}
        {clients.filter(c => !vipRanking.some(r => r.client.id === c.id)).length > 0 && (
          <>
            <h2 style={{ color: '#94a3b8', marginTop: 24 }}>Clients inactifs ce mois</h2>
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Téléphone</th>
                  <th>Adresse</th>
                  <th style={{ textAlign: 'right' }}>CA Total (all time)</th>
                </tr>
              </thead>
              <tbody>
                {sortList(clients.filter(c => !vipRanking.some(r => r.client.id === c.id)), clientSort, clientComparators).map(c => (
                  <tr key={c.id}>
                    <td className="client-name">{c.name}</td>
                    <td>{c.phone}</td>
                    <td>{c.address || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{getClientTotalSpendAndCC(c.id).spent.toLocaleString()} F</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <div className="footer-note">
          Forever CashFlow · Les Conquérants de l'Excellente Vie · Coach Alvine YOKA · Pointe-Noire, Congo-Brazzaville
        </div>
      </div>

    </div>
  );
};