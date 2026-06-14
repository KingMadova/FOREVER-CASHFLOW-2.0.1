import React, { useState } from 'react';
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
  MessageCircle
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

      {/* 2. Unified sleek Search filter */}
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
                      {c.synced === false && (
                        <span className="text-[8px] font-black uppercase py-0.5 px-1.5 rounded-full bg-red-100 text-red-600 dark:bg-red-950/70 dark:text-red-400 border border-red-200/30 tracking-wider flex items-center gap-1 select-none animate-pulse" title="Créé hors-ligne. En attente de réseau.">
                          <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                          Hors-ligne
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{c.phone}</p>
                    
                    {/* Performance metrics below */}
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-amber-600 dark:text-amber-400 font-extrabold uppercase">
                      <span>{spent.toLocaleString()} F</span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span>{cc.toFixed(3)} CC</span>
                    </div>
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

    </div>
  );
};
