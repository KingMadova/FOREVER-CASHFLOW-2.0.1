import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Card } from '../components/ui/Card';
import { Drawer } from '../components/ui/Drawer';
import { Customer, CustomerStatus, PipelineStage } from '../types';
import { 
  Phone, 
  Mail, 
  MapPin, 
  UserPlus, 
  Search, 
  Trash2, 
  ChevronsRight, 
  Info,
  CalendarCheck,
  Edit2,
  MessageCircle
} from 'lucide-react';

const STAGES: { code: PipelineStage; label: string; desc: string; color: string }[] = [
  { code: 'CONTACT_INITIATED', label: 'Initié', desc: 'Contact pris', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' },
  { code: 'PRESENTATION_DONE', label: 'Présenté', desc: 'Présentation FLP faite', color: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400' },
  { code: 'FOLLOW_UP_REQUIRED', label: 'Relance', desc: 'Suivi requis', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' },
  { code: 'CLOSED_WON', label: 'Gagné (FBO/Client)', desc: 'Vente / Signature', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' },
  { code: 'CLOSED_LOST', label: 'Perdu / Standby', desc: 'Non intéressé', color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' }
];

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

export const ProspectsView: React.FC = () => {
  const { customers, addCustomer, updateCustomer, deleteCustomer } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStage, setSelectedStage] = useState<PipelineStage | 'ALL'>('ALL');
  
  // Drawer states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<Customer | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // New Prospect Fields
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newStage, setNewStage] = useState<PipelineStage>('CONTACT_INITIATED');

  // Filter prospects
  const prospects = customers.filter(c => c.status === CustomerStatus.PROSPECT);

  const filteredProspects = prospects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.phone.includes(searchTerm) || 
                          (p.notes && p.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStage = selectedStage === 'ALL' || p.pipelineStage === selectedStage;
    return matchesSearch && matchesStage;
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newPhone) return;

    addCustomer({
      name: newName,
      email: newEmail,
      phone: newPhone,
      address: newAddress,
      status: CustomerStatus.PROSPECT,
      pipelineStage: newStage,
      lastContactDate: new Date().toISOString().split('T')[0],
      notes: newNotes
    });

    // Reset Form
    setNewName('');
    setNewEmail('');
    setNewPhone('');
    setNewAddress('');
    setNewNotes('');
    setNewStage('CONTACT_INITIATED');
    setIsAddOpen(false);
  };

  const handleStageChange = (prospect: Customer, nextStage: PipelineStage) => {
    updateCustomer({
      ...prospect,
      pipelineStage: nextStage,
      lastContactDate: new Date().toISOString().split('T')[0]
    });
    if (selectedProspect && selectedProspect.id === prospect.id) {
      setSelectedProspect(prev => prev ? { ...prev, pipelineStage: nextStage } : null);
    }
  };

  const handleConvertClient = (prospect: Customer) => {
    updateCustomer({
      ...prospect,
      status: CustomerStatus.CLIENT,
      pipelineStage: 'CLOSED_WON',
      lastContactDate: new Date().toISOString().split('T')[0]
    });
    setIsDetailOpen(false);
  };

  return (
    <div className="space-y-6" id="prospects_view_container">
      
      {/* 1. Header Row */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Suivi des Prospects FLP</h2>
          <p className="text-xs text-slate-500">Pipeline de conversion et de recrutement.</p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="py-3 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-2xl active:scale-95 transition-all flex items-center gap-2 shrink-0 h-12"
          id="prospect_add_new_btn"
        >
          <UserPlus className="w-4 h-4" />
          AJOUTER UN PROSPECT
        </button>
      </div>

      {/* 2. Search & Stage Filter Chips (designed for thumb swiping) */}
      <div className="space-y-3">
        {/* Search Input */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
            <Search className="w-5 h-5" />
          </span>
          <input
            type="text"
            placeholder="Rechercher par nom, téléphone, notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-[#1f1f22] border border-slate-200 dark:border-slate-800 rounded-2xl py-3 pl-11 pr-4 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all h-12"
            id="prospect_search_input"
          />
        </div>

        {/* Swipeable Horizontal Stage List */}
        <div className="flex gap-2 mx-[-1rem] px-4 overflow-x-auto pb-1 scrollbar-none snap-x select-none">
          <button
            onClick={() => setSelectedStage('ALL')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 snap-start h-9 ${
              selectedStage === 'ALL'
                ? 'bg-amber-500 text-white'
                : 'bg-white dark:bg-[#1f1f22] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
            }`}
            id="prospect_stage_chip_all"
          >
            Tous ({prospects.length})
          </button>
          {STAGES.map(st => {
            const count = prospects.filter(p => p.pipelineStage === st.code).length;
            return (
              <button
                key={st.code}
                onClick={() => setSelectedStage(st.code)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 snap-start h-9 ${
                  selectedStage === st.code
                    ? 'bg-amber-500 text-white'
                    : 'bg-white dark:bg-[#1f1f22] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
                id={`prospect_stage_chip_${st.code}`}
              >
                {st.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Prospects Listing Cards (Optimized mobile alternative to a table) */}
      <div className="space-y-3" id="prospects_list_area">
        {filteredProspects.length === 0 ? (
          <Card className="text-center py-10">
            <p className="text-sm text-slate-400">Aucun prospect trouvé pour ce critère.</p>
          </Card>
        ) : (
          filteredProspects.map(pr => {
            const currentStageObj = STAGES.find(s => s.code === pr.pipelineStage);
            return (
              <Card 
                key={pr.id} 
                className="hoverable active:scale-98 flex items-center justify-between gap-3 text-left p-4 rounded-3xl"
                onClick={() => {
                  setSelectedProspect(pr);
                  setIsDetailOpen(true);
                }}
                id={`prospect_card_${pr.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-950 dark:text-slate-100 truncate text-base">{pr.name}</h3>
                    <span className={`text-[9px] font-extrabold uppercase py-0.5 px-2 rounded-full tracking-wider ${
                      currentStageObj?.color || ''
                    }`}>
                      {currentStageObj?.label}
                    </span>
                    {pr.synced === false && (
                      <span className="text-[8px] font-black uppercase py-0.5 px-1.5 rounded-full bg-red-100 text-red-600 dark:bg-red-950/70 dark:text-red-400 border border-red-200/30 tracking-wider flex items-center gap-1 select-none" title="Cet élément a été créé hors-ligne et sera synchronisé au retour du réseau.">
                        <span className="w-1 h-1 bg-red-500 rounded-full animate-pulse" />
                        Hors-ligne
                      </span>
                    )}
                  </div>
                  
                  {pr.notes && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1">
                      {pr.notes}
                    </p>
                  )}

                  <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400 font-bold">
                    <span>Contact: {pr.lastContactDate}</span>
                    {pr.address && <span className="truncate max-w-[150px]">📍 {pr.address}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* WhatsApp button */}
                  <a
                    href={`https://wa.me/${cleanPhoneForWhatsApp(pr.phone)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()} // Prevent drawer from opening
                    className="w-11 h-11 bg-emerald-50 dark:bg-emerald-950/45 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900 rounded-full flex items-center justify-center shrink-0 active:scale-90 transition-all border border-emerald-200/50 dark:border-emerald-800/30"
                    aria-label="WhatsApp direct"
                    title="WhatsApp direct"
                  >
                    <MessageCircle className="w-5 h-5" />
                  </a>

                  {/* Mobile call button direct touch integration */}
                  <a
                    href={`tel:${pr.phone}`}
                    onClick={(e) => e.stopPropagation()} // Prevent drawer from opening
                    className="w-11 h-11 bg-amber-50 dark:bg-amber-950 text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900 rounded-full flex items-center justify-center shrink-0 active:scale-90 transition-all border border-amber-200/50 dark:border-amber-800/35"
                    aria-label="Appeler"
                    id={`prospect_call_direct_${pr.id}`}
                  >
                    <Phone className="w-5 h-5" />
                  </a>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* 4. DRAWER: ADD PROSPECT */}
      <Drawer isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Nouveau Prospect FLP">
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Nom complet *</label>
            <input
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Jean Dupont"
              className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Téléphone *</label>
              <input
                type="tel"
                required
                inputMode="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="e.g. +221 77 654 12 34"
                className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">E-mail</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="e.g. jean@example.com"
                className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Adresse / Ville</label>
            <input
              type="text"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              placeholder="e.g. Secteur 1, Centre-Ville"
              className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Étape du Pipeline</label>
            <select
              value={newStage}
              onChange={(e) => setNewStage(e.target.value as PipelineStage)}
              className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white"
            >
              {STAGES.map(s => (
                <option key={s.code} value={s.code}>{s.label} - {s.desc}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Notes initiales</label>
            <textarea
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="e.g. Intéressé par l'Aloès pour des problèmes d'estomac..."
              rows={3}
              className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 text-[#101010] dark:text-white"
            />
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-2xl shadow-lg active:scale-95 transition-all text-sm mt-4"
          >
            SAUVEGARDER LE PROSPECT
          </button>
        </form>
      </Drawer>

      {/* 5. DRAWER: DETAILS & PIPELINE STATUS EDITING */}
      <Drawer
        isOpen={isDetailOpen && selectedProspect !== null}
        onClose={() => {
          setIsDetailOpen(false);
          setShowDeleteConfirm(false);
        }}
        title={selectedProspect?.name || 'Fiche Prospect'}
      >
        {selectedProspect && (
          <div className="space-y-6">
            
            {/* Quick action shortcuts */}
            <div className="flex gap-2">
              <a
                href={`tel:${selectedProspect.phone}`}
                className="flex-1 py-3 px-1 bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border border-slate-200/40 dark:border-slate-700/40"
              >
                <Phone className="w-4 h-4" />
                Appeler
              </a>
              <a
                href={`https://wa.me/${cleanPhoneForWhatsApp(selectedProspect.phone)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3 px-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:hover:bg-emerald-900 dark:text-emerald-400 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border border-emerald-200/40 dark:border-emerald-800/20 active:scale-95 transition-all text-center"
              >
                <MessageCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                WhatsApp
              </a>
              <a
                href={`mailto:${selectedProspect.email}`}
                className="flex-1 py-3 px-1 bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border border-slate-200/40 dark:border-slate-700/40"
              >
                <Mail className="w-4 h-4" />
                Email
              </a>
            </div>

            {/* General Info list */}
            <div className="space-y-3 bg-slate-50 dark:bg-[#2a2a2e]/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400 font-bold w-20 shrink-0">Téléphone:</span>
                <span className="text-slate-800 dark:text-slate-200 font-semibold">{selectedProspect.phone}</span>
              </div>
              {selectedProspect.email && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400 font-bold w-20 shrink-0">E-mail:</span>
                  <span className="text-slate-800 dark:text-slate-200 font-semibold truncate">{selectedProspect.email}</span>
                </div>
              )}
              {selectedProspect.address && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400 font-bold w-20 shrink-0">Adresse:</span>
                  <span className="text-slate-800 dark:text-slate-200 font-semibold truncate">{selectedProspect.address}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400 font-bold w-20 shrink-0">Créé le:</span>
                <span className="text-slate-600 dark:text-slate-400 font-medium">{selectedProspect.createdAt}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400 font-bold w-20 shrink-0">Dernier contact:</span>
                <span className="text-slate-800 dark:text-slate-200 font-bold">{selectedProspect.lastContactDate}</span>
              </div>
            </div>

            {/* Note Area */}
            <div>
              <h4 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Notes FLP</h4>
              <p className="text-sm text-slate-700 dark:text-slate-300 bg-amber-50/50 dark:bg-amber-950/15 border border-amber-200/50 dark:border-amber-800/20 p-3 rounded-2xl italic leading-relaxed">
                {selectedProspect.notes || 'Aucune note additionnelle.'}
              </p>
            </div>

            {/* Step selection */}
            <div>
              <h4 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                Étape du Pipeline (Calcul direct)
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {STAGES.map(s => {
                  const active = selectedProspect.pipelineStage === s.code;
                  return (
                    <button
                      key={s.code}
                      onClick={() => handleStageChange(selectedProspect, s.code)}
                      className={`py-2.5 px-3 rounded-xl text-left text-xs font-bold transition-all border ${
                        active
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-white dark:bg-[#1f1f22] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Primary transform converter: Transform as real Client */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
              {showDeleteConfirm ? (
                <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl space-y-3 animate-in fade-in zoom-in-95 duration-150">
                  <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 text-left leading-relaxed">
                    Supprimer ce prospect définitivement de votre base de données ?
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        deleteCustomer(selectedProspect.id);
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
                <div className="flex gap-2">
                  <button
                    onClick={() => handleConvertClient(selectedProspect)}
                    className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold rounded-2xl active:scale-95 transition-all text-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ChevronsRight className="w-5 h-5 animate-pulse" />
                    CONVERTIR EN CLIENT FLP
                  </button>

                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/40 rounded-2xl active:scale-95 transition-all text-xs border border-red-200/50 dark:border-red-900/30 shrink-0 cursor-pointer"
                    title="Supprimer"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>

          </div>
        )}
      </Drawer>

    </div>
  );
};
