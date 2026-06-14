import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Card } from '../components/ui/Card';
import { Drawer } from '../components/ui/Drawer';
import { 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  MapPin, 
  CheckCircle, 
  Plus, 
  Trash2,
  CalendarDays,
  Bell,
  CheckCircle2,
  AlertCircle,
  Search
} from 'lucide-react';

interface AgendaItem {
  id: string;
  title: string;
  date: string;
  time: string;
  type: 'FOLLOW_UP' | 'DELIVERY' | 'PRESENTATION' | 'OTHER';
  contactName?: string;
  contactPhone?: string;
  location?: string;
  notes?: string;
  completed: boolean;
}

export const AgendaView: React.FC = () => {
  const { 
    customers,
    agendaList,
    addAgendaItem,
    deleteAgendaItem,
    toggleAgendaItemCompleted
  } = useStore();

  // State controllers for Adding Event
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [dateStr, setDateStr] = useState(new Date().toISOString().split('T')[0]);
  const [timeStr, setTimeStr] = useState('09:00');
  const [type, setType] = useState<AgendaItem['type']>('FOLLOW_UP');
  
  // Link to existing contact for easy access
  const [contactId, setContactId] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  // Autocomplete search states for contact linking
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const selectedContact = contactId ? customers.find(c => c.id === contactId) : null;
  const filteredContacts = customers.filter(c => 
    c.name.toLowerCase().includes(contactSearchQuery.toLowerCase()) ||
    c.phone.includes(contactSearchQuery)
  );

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !dateStr) return;

    let linkedCustomerName = '';
    let linkedPhone = '';

    if (contactId) {
      const found = customers.find(c => c.id === contactId);
      if (found) {
        linkedCustomerName = found.name;
        linkedPhone = found.phone;
      }
    }

    addAgendaItem({
      title,
      date: dateStr,
      time: timeStr,
      type,
      contactName: linkedCustomerName || undefined,
      contactPhone: linkedPhone || undefined,
      location: location || undefined,
      notes: notes || undefined
    });

    // Reset fields
    setTitle('');
    setLocation('');
    setNotes('');
    setContactId('');
    setContactSearchQuery('');
    setIsSuggestionsOpen(false);
    setIsAddOpen(false);
  };

  const handleToggleComplete = (id: string) => {
    toggleAgendaItemCompleted(id);
  };

  const handleDeleteEvent = (id: string) => {
    if (confirm('Voulez-vous supprimer ce rendez-vous ?')) {
      deleteAgendaItem(id);
    }
  };

  const getBadgeStyle = (t: AgendaItem['type']) => {
    switch(t) {
      case 'FOLLOW_UP':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400';
      case 'DELIVERY':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400';
      case 'PRESENTATION':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-400';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-[#2a2a2e] dark:text-slate-400';
    }
  };

  const getTypeLabel = (t: AgendaItem['type']) => {
    switch(t) {
      case 'FOLLOW_UP': return 'Suivi relance';
      case 'DELIVERY': return 'Livraison';
      case 'PRESENTATION': return 'Présentation';
      default: return 'Autre tâche';
    }
  };

  return (
    <div className="space-y-6 text-left" id="agenda_view_container">
      
      {/* 1. Header and CTA */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Planificateur & Relances FLP</h2>
          <p className="text-xs text-slate-500">Ne manquez aucune livraison ni aucun suivi client.</p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="py-3 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-2xl active:scale-95 transition-all flex items-center gap-2 shrink-0 h-12"
          id="agenda_add_btn"
        >
          <Plus className="w-4 h-4" />
          RENDEZ-VOUS (PLAN)
        </button>
      </div>

      {/* 2. Overdue or Today Alerts info box */}
      <div className="bg-amber-55/10 dark:bg-amber-950/20 border border-amber-200/50 p-4 rounded-3xl flex items-start gap-3">
        <Bell className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-xs font-extrabold text-[#111111] dark:text-amber-400 uppercase tracking-wider">Priorités du FBO</h4>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Les prospects ont besoin de relances fréquentes sous 48h. C’est la clé pour bâtir un réseau actif de distributeurs qualifiés.
          </p>
        </div>
      </div>

      {/* 3. Mapping events block */}
      <div className="space-y-3" id="agenda_items_map">
        {agendaList.length === 0 ? (
          <Card className="text-center py-10">
            <p className="text-sm text-slate-400">Aucune tâche enregistrée dans votre calendrier.</p>
          </Card>
        ) : (
          [...agendaList]
            .sort((a,b) => {
              if (a.completed !== b.completed) return a.completed ? 1 : -1;
              return new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime();
            })
            .map(item => (
              <Card
                key={item.id}
                className={`p-4 rounded-3xl border transition-all relative ${
                  item.completed 
                    ? 'bg-slate-50/60 dark:bg-slate-900/10 border-slate-200 dark:border-slate-800 opacity-60' 
                    : 'bg-white dark:bg-[#1f1f22] border-slate-200 dark:border-slate-800 shadow-sm'
                }`}
                id={`agenda_item_card_${item.id}`}
              >
                <div className="flex items-start gap-3">
                  {/* Interactive circle check status */}
                  <button
                    onClick={() => handleToggleComplete(item.id)}
                    className="mt-1 shrink-0 active:scale-90 transition-all text-slate-300 hover:text-amber-500"
                    id={`agenda_item_toggle_${item.id}`}
                  >
                    {item.completed ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    ) : (
                      <div className="w-6 h-6 rounded-full border-2 border-slate-300 dark:border-slate-700" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[8px] font-extrabold uppercase py-0.5 px-2 rounded-full tracking-wider ${getBadgeStyle(item.type)}`}>
                        {getTypeLabel(item.type)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                        <CalendarDays className="w-3.5 h-3.5" />
                        {item.date} • {item.time}
                      </span>
                    </div>

                    <h3 className={`font-bold mt-1 text-base leading-tight ${
                      item.completed ? 'line-through text-slate-400' : 'text-slate-950 dark:text-slate-50'
                    }`}>
                      {item.title}
                    </h3>

                    {/* Linked contact details for direct calling or viewing */}
                    {item.contactName && (
                      <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-xs border border-slate-100 dark:border-slate-800">
                        <span className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" /> {item.contactName}
                        </span>
                        {item.contactPhone && (
                          <a href={`tel:${item.contactPhone}`} className="text-amber-500 font-bold flex items-center gap-0.5 hover:underline" onClick={e => e.stopPropagation()}>
                            <Phone className="w-3 h-3" /> {item.contactPhone}
                          </a>
                        )}
                        {item.location && (
                          <span className="text-slate-500 font-semibold flex items-center gap-0.5">
                            <MapPin className="w-3 h-3" /> {item.location}
                          </span>
                        )}
                      </div>
                    )}

                    {item.notes && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 italic mt-2 bg-amber-50/20 p-2 rounded-xl">
                        "{item.notes}"
                      </p>
                    )}
                  </div>

                  {/* Delete button option */}
                  {deletingId === item.id ? (
                    <div className="flex flex-col items-end gap-1 shrink-0 self-start animate-in fade-in zoom-in-95 duration-100">
                      <button
                        onClick={() => {
                          deleteAgendaItem(item.id);
                          setDeletingId(null);
                        }}
                        className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[9px] rounded-lg transition-all active:scale-95 cursor-pointer"
                        title="Confirmer"
                      >
                        Supprimer ?
                      </button>
                      <button
                        onClick={() => setDeletingId(null)}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-350 font-bold text-[9px] rounded-lg transition-all cursor-pointer"
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeletingId(item.id)}
                      className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg active:scale-90 transition-all shrink-0 self-start cursor-pointer"
                      title="Supprimer évènement"
                      id={`agenda_item_delete_${item.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </Card>
            ))
        )}
      </div>

      {/* 4. DRAWER: ADD EVENT */}
      <Drawer isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Nouveau Rendez-vous FBO">
        <form onSubmit={handleAddEvent} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">Titre / Objectif *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Relancer Olivier Dubois suite à démo"
              className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">Date rendez-vous *</label>
              <input
                type="date"
                required
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">Heure *</label>
              <input
                type="time"
                required
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">Type d'activité</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AgendaItem['type'])}
              className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white"
            >
              <option value="FOLLOW_UP">Suivi prospect / Relance client</option>
              <option value="DELIVERY">Livraison de produits FLP</option>
              <option value="PRESENTATION">Présentation d'opportunité d'Affaire</option>
              <option value="OTHER">Autre tâche FBO</option>
            </select>
          </div>

          {/* Link customer optional slider */}
          <div className="space-y-1 relative" id="agenda_contact_autocomplete">
            <label className="text-xs font-bold text-slate-500 block mb-1">Lier à un contact existant (optionnel)</label>
            {contactId ? (
              <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/30 dark:border-amber-800/40 rounded-2xl h-12 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-amber-200/40 dark:bg-amber-500/10 flex items-center justify-center text-amber-500 font-bold text-xs uppercase">
                    {selectedContact?.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-800 dark:text-slate-100 leading-none">{selectedContact?.name}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase mt-1">
                      {selectedContact?.status === 'CLIENT' ? 'Client' : 'Prospect'} • {selectedContact?.phone}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setContactId('');
                    setContactSearchQuery('');
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-all cursor-pointer font-bold text-xs"
                  title="Enlever le lien"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Chercher par nom ou numéro de téléphone..."
                    value={contactSearchQuery}
                    onFocus={() => setIsSuggestionsOpen(true)}
                    onChange={(e) => {
                      setContactSearchQuery(e.target.value);
                      setIsSuggestionsOpen(true);
                    }}
                    className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl pl-10 pr-4 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white placeholder-slate-400 font-sans"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-4" />
                  {contactSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setContactSearchQuery('')}
                      className="absolute right-3.5 top-3.5 text-xs text-slate-400 font-black hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Suggestions dropdown overlay */}
                {isSuggestionsOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsSuggestionsOpen(false)} 
                    />
                    <div className="absolute left-0 right-0 top-13 max-h-48 overflow-y-auto bg-white dark:bg-[#1f1f22] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in duration-100">
                      {filteredContacts.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setContactId(c.id);
                            setIsSuggestionsOpen(false);
                            setContactSearchQuery('');
                          }}
                          className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">{c.name}</span>
                            <span className="text-[10px] text-slate-500 font-medium">Tél: {c.phone}</span>
                          </div>
                          <span className={`text-[9.5px] font-extrabold uppercase py-0.5 px-2 rounded-full shrink-0 ${
                            c.status === 'CLIENT' 
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' 
                              : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                          }`}>
                            {c.status === 'CLIENT' ? 'Client' : 'Prospect'}
                          </span>
                        </button>
                      ))}
                      {filteredContacts.length === 0 && (
                        <div className="p-3 text-xs text-slate-400 text-center font-mono">
                          Aucun contact trouvé
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">Lieu (Espace café, Secteur commercial...)</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Espace Café du Centre"
              className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">Notes / Instructions spécifiques</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Amener les fiches produits et de la Pulpe d'Aloès pour dégustation."
              rows={3}
              className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 text-[#101010] dark:text-white"
            />
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-2xl shadow-lg active:scale-95 transition-all text-sm mt-4"
          >
            PLANIFIER TÂCHE
          </button>
        </form>
      </Drawer>

    </div>
  );
};
