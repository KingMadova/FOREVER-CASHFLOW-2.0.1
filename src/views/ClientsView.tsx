import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Card } from '../components/ui/Card';
import { Drawer } from '../components/ui/Drawer';
import { Customer, CustomerStatus, Order } from '../types';
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
  ChevronDown
} from 'lucide-react';

const cleanPhoneForWhatsApp = (phoneStr: string) => {
  let cleaned = phoneStr.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }
  if (cleaned.length === 9) {
    if (cleaned.startsWith('06') || cleaned.startsWith('05') || cleaned.startsWith('04')) {
      return '242' + cleaned.substring(1);
    }
    if (cleaned.startsWith('77') || cleaned.startsWith('76') || cleaned.startsWith('78') || cleaned.startsWith('70')) {
      return '221' + cleaned;
    }
  } else if (cleaned.length === 8) {
    if (cleaned.startsWith('6') || cleaned.startsWith('5') || cleaned.startsWith('4')) {
      return '242' + cleaned;
    }
  }
  return cleaned;
};

export const ClientsView: React.FC = () => {
  const { customers, orders, addCustomer, updateCustomer, deleteCustomer } = useStore();
  
  // States
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Customer | null>(null);
  const [activeTab, setActiveTab] = useState<'INFO' | 'ORDERS' | 'NOTES'>('INFO');

  // Input states
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [notesSavedFeedback, setNotesSavedFeedback] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Filtering list
  const clients = customers.filter(c => c.status === CustomerStatus.CLIENT);

  const filteredClients = clients.filter(cl => {
    return cl.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
           cl.phone.includes(searchTerm) || 
           (cl.address && cl.address.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newPhone) return;

    addCustomer({
      name: newName,
      email: newEmail,
      phone: newPhone,
      address: newAddress,
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
    setNewNotes('');
    setIsAddOpen(false);
  };

  // Get orders specifically for a specific client
  const getClientOrders = (clientId: string) => {
    return orders.filter(o => o.customerId === clientId);
  };

  const getClientTotalSpendAndCC = (clientId: string) => {
    const clientOrders = getClientOrders(clientId).filter(o => o.status === 'VALIDATED');
    const spent = clientOrders.reduce((sum, o) => sum + o.totalRetail, 0);
    const cc = clientOrders.reduce((sum, o) => sum + o.totalCC, 0);
    return { spent, cc };
  };

  // Commandes validées d un client sur le mois selectionne
  const getClientOrdersForMonth = (clientId: string) => {
    return orders.filter(o => {
      if (o.status !== 'VALIDATED') return false;
      if (o.customerId !== clientId) return false;
      const dateStr = o.validatedAt || o.date;
      const d = new Date(dateStr);
      return d.getFullYear() === selectedYear && (d.getMonth() + 1) === selectedMonth;
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

  const isVip = (clientId: string) => vipRanking.findIndex(r => r.client.id === clientId) < 3 && vipRanking.some(r => r.client.id === clientId);

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
    <div className="space-y-6" id="clients_view_container">
      
      {/* 1. Header with Add button */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Fiches Clients FLP</h2>
          <p className="text-xs text-slate-500">Consommateurs fidèles et récurrents de vos produits.</p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="py-3 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-2xl active:scale-95 transition-all flex items-center gap-2 shrink-0 h-12"
          id="client_add_btn"
        >
          <UserPlus className="w-4 h-4" />
          AJOUTER UN CLIENT
        </button>
      </div>

      {/* 2. Sélecteur de période + export VIP */}
      <div className="flex items-center gap-2 flex-wrap">
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
        <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30 rounded-2xl p-3">
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

      {/* 3. Unified sleek Search filter */}
      <div className="relative">
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

      {/* 3. Clients Listing Grid */}
      <div className="space-y-3" id="clients_listing_area">
        {filteredClients.length === 0 ? (
          <Card className="text-center py-10">
            <p className="text-sm text-slate-400">Aucun client trouvé.</p>
          </Card>
        ) : (
          filteredClients.map(c => {
            const { spent, cc } = getClientTotalSpendAndCC(c.id);
            const clientInitials = c.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

            return (
              <Card
                key={c.id}
                className="hoverable active:scale-98 flex items-center justify-between gap-3 text-left p-4 rounded-3xl"
                onClick={() => {
                  setSelectedClient(c);
                  setNewNotes(c.notes || '');
                  setActiveTab('INFO');
                  setIsDetailOpen(true);
                }}
                id={`client_card_${c.id}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Initials custom Avatar block matching design system spec */}
                  <div className="w-12 h-12 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900 rounded-full flex items-center justify-center font-extrabold text-sm shrink-0">
                    {clientInitials || 'CL'}
                  </div>
                  
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 truncate text-base leading-snug flex items-center gap-1.5 flex-wrap">
                      <span>{c.name}</span>
                      {isVip(c.id) && (
                        <span className="text-[8px] font-black uppercase py-0.5 px-1.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-300/50 flex items-center gap-0.5">
                          ⭐ VIP
                        </span>
                      )}
                      {c.synced === false && (
                        <span className="text-[8px] font-black uppercase py-0.5 px-1.5 rounded-full bg-red-100 text-red-600 dark:bg-red-950/70 dark:text-red-400 border border-red-200/30 tracking-wider flex items-center gap-1 select-none animate-pulse" title="Créé hors-ligne. En attente de réseau.">
                          <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                          Hors-ligne
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{c.phone}</p>
                    
                    {/* Métriques : total global + ce mois */}
                    {(() => {
                      const monthStats = getClientMonthStats(c.id);
                      return (
                        <div className="flex flex-col gap-0.5 mt-1">
                          <div className="flex items-center gap-2 text-[10px] text-amber-600 dark:text-amber-400 font-extrabold uppercase">
                            <span>{spent.toLocaleString()} F</span>
                            <span className="text-slate-300 dark:text-slate-700">•</span>
                            <span>{cc.toFixed(3)} CC</span>
                          </div>
                          {monthStats.count > 0 && (
                            <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">
                              {periodLabel} : {monthStats.count} cmd · {monthStats.spent.toLocaleString()} F
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* WhatsApp anchor tag */}
                  <a
                    href={`https://wa.me/${cleanPhoneForWhatsApp(c.phone)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="w-11 h-11 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900 rounded-full flex items-center justify-center active:scale-90 transition-all border border-emerald-200/50 dark:border-emerald-800/30"
                    aria-label="WhatsApp direct"
                    title="Contacter sur WhatsApp"
                  >
                    <MessageCircle className="w-5 h-5" />
                  </a>

                  {/* Phone anchor tag */}
                  <a
                    href={`tel:${c.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="w-11 h-11 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-amber-50 rounded-full flex items-center justify-center active:scale-90 transition-all border border-slate-200/50 dark:border-slate-700/50"
                    aria-label="Appeler direct"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                  <ChevronRight className="w-5 h-5 text-slate-300" />
                </div>
              </Card>
            );
          })
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
              placeholder="e.g. Fatou Diop"
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
                placeholder="e.g. +221 77..."
                className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">E-mail</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="e.g. fatou@gmail.com"
                className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">Adresse de livraison</label>
            <input
              type="text"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              placeholder="e.g. Secteur 2, Zone Commerciale"
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
        isOpen={isDetailOpen && selectedClient !== null}
        onClose={() => {
          setIsDetailOpen(false);
          setShowDeleteConfirm(false);
        }}
        title={selectedClient?.name || 'Fiche Client'}
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
            </div>

            {/* Tap Navigation Switches inside Drawer */}
            <div className="flex border-b border-slate-100 dark:border-slate-800 pb-2 gap-4">
              {(['INFO', 'ORDERS', 'NOTES'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`text-xs font-bold pb-2 transition-all outline-none ${
                    activeTab === tab
                      ? 'text-amber-500 border-b-2 border-amber-500'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {tab === 'INFO' ? 'Informations' : tab === 'ORDERS' ? 'Commandes' : 'Notes & Suivi'}
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
                  {selectedClient.address && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-400 font-bold w-20 shrink-0">Adresse:</span>
                      <span className="text-slate-800 dark:text-slate-200 font-semibold">{selectedClient.address}</span>
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
                {clients.filter(c => !vipRanking.some(r => r.client.id === c.id)).map(c => (
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