import React, { useState, useEffect, useRef } from 'react';
import { useAgendaStore } from '../../store/slices/agendaSlice';
import { useOrdersStore } from '../../store/slices/ordersSlice';
import { useCustomersStore } from '../../store/slices/customersSlice';
import { useAuthStore } from '../../store/slices/authSlice';
import { AgendaItem, Order, OrderStatus, Customer } from '../../types';
import {
  getActiveRelances,
  stageLabel,
  type RelanceInfo
} from '../../lib/relanceService';
import {
  getActivePurchaseFollowUps,
  purchaseAnchorDate
} from '../../lib/postPurchaseService';
import {
  canNotifyNatively,
  getNativePermission,
  wasPromptDismissed,
  markPromptAnswered,
  showNativeNotification,
  alreadyNotifiedToday,
  markNotifiedToday,
} from '../../lib/nativeNotificationService';
import {
  Bell,
  Check,
  Clock,
  Phone,
  MessageCircle,
  CalendarDays,
  X,
  ChevronRight,
  Sparkles,
  Volume2,
  VolumeX,
  AlertTriangle,
  ShoppingBag,
  AlertCircle,
  HelpCircle,
  UserPlus,
  BellRing
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export const NotificationCenter: React.FC = () => {
  const { 
    agendaList, 
    toggleAgendaItemCompleted,
    updateAgendaItem
  } = useAgendaStore();
  const { orders, updateOrder } = useOrdersStore();
  const { customers, updateCustomer } = useCustomersStore();
  const { isAuthenticated } = useAuthStore();
  
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Audio state
  const [isMuted, setIsMuted] = useState(() => {
    try {
      return localStorage.getItem('fcf-notifications-muted') === 'true';
    } catch {
      return false;
    }
  });

  // Tab state: 'all' | 'followups' | 'deadlines'
  const [activeTab, setActiveTab] = useState<'all' | 'followups' | 'deadlines'>('all');

  // Helper synthetic chime sound using Web Audio API (totally offline-safe, no static files needed)
  const playNotificationChime = (isSuccess = false) => {
    try {
      const mutedValue = localStorage.getItem('fcf-notifications-muted') === 'true';
      if (mutedValue) return;

      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      const playNote = (freq: number, startTime: number, duration: number, type: 'sine' | 'triangle' = 'sine') => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);
        
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.06, startTime + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(startTime);
        osc.stop(startTime + duration + 0.1);
      };

      const now = ctx.currentTime;
      if (isSuccess) {
        // High, cheerful major third chime for success
        playNote(523.25, now, 0.15, 'sine'); // C5
        playNote(659.25, now + 0.06, 0.25, 'sine'); // E5
      } else {
        // Soft focus dual-tone notice
        playNote(587.33, now, 0.1, 'triangle'); // D5
        playNote(783.99, now + 0.05, 0.2, 'sine'); // G5
      }
    } catch (err) {
      console.warn("Web Audio API was blocked or not supported yet: ", err);
    }
  };

  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    try {
      localStorage.setItem('fcf-notifications-muted', String(nextMute));
      if (!nextMute) {
        // play small test chime
        setTimeout(() => playNotificationChime(true), 100);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Helper to get local date string YYYY-MM-DD
  const getLocalDateString = (offsetDays = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getLocalDateString();
  const tomorrowStr = getLocalDateString(1);

  // Parse days pending for an order
  const getDaysPending = (orderDateStr: string): number => {
    try {
      const orderDate = new Date(orderDateStr);
      const todayDate = new Date(todayStr);
      const diffTime = todayDate.getTime() - orderDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    } catch {
      return 0;
    }
  };

  // 1. Follow-up Alarms from Agenda (Uncompleted, scheduled for today or past)
  // Also Agenda items of type FOLLOW_UP or PRESENTATION
  const followUpAlarms = agendaList.filter(item => 
    !item.completed && 
    (item.type === 'FOLLOW_UP' || item.type === 'PRESENTATION') &&
    item.date <= todayStr
  );

  // 2. Upcoming Order Deadlines Alarms
  // - Uncompleted DELIVERY agenda items (today or past due/pending)
  const deliveryAlarms = agendaList.filter(item =>
    !item.completed &&
    item.type === 'DELIVERY' &&
    item.date <= todayStr
  );

  // - Pending Orders (representing a transactional deadline that needs FBO validation within e.g. 72h)
  const pendingOrders = orders.filter(order => order.status === OrderStatus.PENDING);

  // 3. RELANCES PROSPECTS (règles J+N par étape du pipeline)
  const activeRelances = getActiveRelances(customers);

  // 4. SUIVIS POST-ACHAT (J+3 démarrage / J+7 satisfaction / J+10 réachat)
  const purchaseFollowUps = getActivePurchaseFollowUps(orders, customers);
  const duePurchaseFollowUps = purchaseFollowUps.filter(f => f.urgency === 'today' || f.urgency === 'due');

  // Total active alerts count
  const alertsCount = followUpAlarms.length + deliveryAlarms.length + pendingOrders.length + activeRelances.length + duePurchaseFollowUps.length;

  // ===== NOTIFICATIONS NATIVES OS =====
  const [nativePerm, setNativePerm] = useState(getNativePermission());
  const [showPermCard, setShowPermCard] = useState(false);

  useEffect(() => {
    // Proposer la carte de permission une seule fois : si support ET pas encore
    // accordé ET pas déjà refusé in-app.
    if (getNativePermission() === 'default' && !wasPromptDismissed()) {
      const t = setTimeout(() => setShowPermCard(true), 4000); // laisse l'app s'ouvrir d'abord
      return () => clearTimeout(t);
    }
  }, []);

  const handleEnableNative = async () => {
    try {
      const perm = await Notification.requestPermission();
      setNativePerm(perm as any);
      markPromptAnswered(perm === 'granted' ? 'granted' : 'denied');
      setShowPermCard(false);
      if (perm === 'granted') {
        playNotificationChime(true);
        await showNativeNotification('Forever CashFlow', {
          body: 'Notifications activées — tes relances prospects arriveront ici 🔔',
          tag: 'fcf-welcome',
        });
      }
    } catch (err) {
      console.error('[nativeNotif] demande permission:', err);
      markPromptAnswered('dismissed');
      setShowPermCard(false);
    }
  };

  const handleDeclineNative = () => {
    markPromptAnswered('dismissed');
    setShowPermCard(false);
  };

  // Envoi natif anti-spam : les relances EN RETARD partent en notification OS,
  // max une par prospect et par jour.
  const notifiedRef = useRef(false);
  useEffect(() => {
    if (!canNotifyNatively() || !isAuthenticated) return;
    if (notifiedRef.current) return; // une seule passe par session
    const lateOnes = activeRelances.filter(r => r.urgency === 'late' && r.customer.status !== ('CLIENT' as any));
    if (lateOnes.length === 0) return;
    notifiedRef.current = true;

    (async () => {
      for (const r of lateOnes.slice(0, 3)) { // max 3 notifs d'un coup
        const key = `relance_${r.customer.id}`;
        if (alreadyNotifiedToday(key)) continue;
        const sent = await showNativeNotification(
          `🔔 Relance : ${r.customer.name}`,
          {
            body: `${r.label} · ${stageLabel(r.customer.pipelineStage)}. Tape pour ouvrir la fiche.`,
            tag: key,
            requireInteraction: false,
          },
        );
        if (sent) markNotifiedToday(key);
      }
      if (lateOnes.length > 3) {
        await showNativeNotification('🔔 Relances en attente', {
          body: `${lateOnes.length - 3} autres prospects attendent une relance.`,
          tag: 'fcf-relance-more',
        });
      }
    })();
  }, [activeRelances]);

  // Clic sur notification -> focus app (géré via focus event du SW)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onFocus = () => { /* l'app reprend le focus quand on tape la notif */ };
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'NOTIF_CLICK') {
        navigate('/prospects');
      }
    });
    return () => navigator.serviceWorker.removeEventListener('message', onFocus);
  }, [navigate]);

  // Action "Contacté aujourd'hui" depuis le centre d'alertes
  const handleMarkContacted = async (relance: RelanceInfo) => {
    try {
      await updateCustomer({
        ...relance.customer,
        lastContactDate: todayStr,
      });
      playNotificationChime(true);
    } catch (err) {
      console.error('markContacted failed:', err);
    }
  };

  // Track initial count to sound chime on increase
  const [prevCount, setPrevCount] = useState(0);
  useEffect(() => {
    if (alertsCount > prevCount && prevCount === 0) {
      // Trigger alarm toast with soft chime on startup if there are things to address
      const timer = setTimeout(() => {
        setShowToast(true);
        playNotificationChime(false);
      }, 1500);
      const hideTimer = setTimeout(() => {
        setShowToast(false);
      }, 9000);
      return () => {
        clearTimeout(timer);
        clearTimeout(hideTimer);
      };
    }
    setPrevCount(alertsCount);
  }, [alertsCount]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  // Snooze function: postpone an Agenda item to tomorrow
  const handleSnooze = async (item: AgendaItem) => {
    try {
      const updatedItem: AgendaItem = {
        ...item,
        date: tomorrowStr
      };
      await updateAgendaItem(updatedItem);
      playNotificationChime(true);
    } catch (err) {
      console.error("Snooze failed:", err);
    }
  };

  // Immediate validation of pending order directly from notification center
  const handleValidateOrder = async (order: Order) => {
    try {
      const updatedOrder: Order = {
        ...order,
        status: OrderStatus.VALIDATED
      };
      await updateOrder(updatedOrder);
      playNotificationChime(true);
    } catch (err) {
      console.error("Order validation failed:", err);
    }
  };

  const getContactInfo = (contactName?: string) => {
    if (!contactName) return null;
    const client = customers.find(c => c.name.toLowerCase() === contactName.toLowerCase());
    return client || null;
  };

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
        return '242' + cleaned;
      }
    } else if (cleaned.length === 8) {
      if (cleaned.startsWith('6') || cleaned.startsWith('5') || cleaned.startsWith('4')) {
        return '242' + cleaned;
      }
    }
    return cleaned;
  };

  return (
    <div className="relative" ref={dropdownRef} id="notification_center_wrapper">
      {/* TRIGGER BUTTON (Header Bar) */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) playNotificationChime(false);
        }}
        className={`relative rounded-full active:scale-95 transition-all outline-none w-12 h-12 flex items-center justify-center cursor-pointer ${
          isOpen
            ? 'bg-amber-500/10 text-amber-500 ring-2 ring-amber-500/30'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
        }`}
        title="Alertes FBO & Rappels"
        id="notification_bell_btn"
      >
        <Bell className="w-5 h-5" />
        
        {alertsCount > 0 && (
          <span 
            className="absolute top-2 right-2 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-white dark:border-[#101012] animate-bounce shrink-0 shadow-sm"
            id="notification_badge_counter"
          >
            {alertsCount}
          </span>
        )}
      </button>

      {/* FLOATING ACTION DROPDOWN */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed top-[64px] left-2 right-2 sm:absolute sm:top-auto sm:left-auto sm:right-0 sm:mt-2.5 sm:w-[410px] bg-white dark:bg-[#1f1f22] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl z-55 overflow-hidden text-left flex flex-col" style={{ maxHeight: 'calc(100vh - 80px)' }}
            id="notification_dropdown_box"
          >
            {/* 1. Header */}
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="text-[13px] font-bold text-slate-900 dark:text-slate-100 leading-none">
                  Centre d'alertes
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5 select-none">
                  {alertsCount} tâche{alertsCount > 1 ? 's' : ''} prioritaire{alertsCount > 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={toggleMute}
                  className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                  title={isMuted ? "Activer le son" : "Désactiver le son"}
                  id="mute_notification_audio_btn"
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4 text-slate-500 dark:text-slate-400" />}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                  title="Fermer"
                >
                  <X className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                </button>
              </div>
            </div>

            {/* 2. Tabs */}
            <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex gap-1.5" id="notification_tab_group">
              {[
                { key: 'all', label: 'Toutes', count: alertsCount },
                { key: 'relances', label: 'Relances', count: activeRelances.length },
                { key: 'purchases', label: 'Achats', count: duePurchaseFollowUps.length },
                { key: 'followups', label: 'Suivis', count: followUpAlarms.length },
                { key: 'deadlines', label: 'Délais', count: deliveryAlarms.length + pendingOrders.length },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`py-1.5 px-2.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer outline-none ${
                    activeTab === tab.key
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  id={`notification_tab_${tab.key}`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            {/* 2-bis. CARTE PERMISSION NOTIFICATIONS NATIVES (une seule fois) */}
            {isOpen && showPermCard && nativePerm === 'default' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="border-b border-slate-100 dark:border-slate-800 overflow-hidden"
              >
                <div className="m-3 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950 p-4 relative overflow-hidden">
                  <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-amber-500/20 blur-xl" />
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/40">
                      <BellRing className="w-5 h-5 text-slate-950" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[13px] font-black text-white leading-tight">
                        Ne rate plus aucune vente
                      </h4>
                      <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                        Reçois tes relances prospects directement sur ton téléphone,
                        même app fermée. Comme une vraie application.
                      </p>
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={handleEnableNative}
                          className="py-2 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-[11px] font-black active:scale-95 transition-all cursor-pointer shadow-lg shadow-amber-500/30"
                        >
                          Activer
                        </button>
                        <button
                          onClick={handleDeclineNative}
                          className="py-2 px-3 text-slate-400 hover:text-slate-200 text-[11px] font-bold active:scale-95 transition-all cursor-pointer"
                        >
                          Plus tard
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 3. DYNAMIC NOTIFICATION ROWS */}
            <div className="max-h-[50vh] sm:max-h-84 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 flex-1" id="notification_dropdown_list">

              {/* If empty tab state */}
              {((activeTab === 'all' && alertsCount === 0) ||
                (activeTab === 'relances' && activeRelances.length === 0) ||
                (activeTab === 'purchases' && duePurchaseFollowUps.length === 0) ||
                (activeTab === 'followups' && followUpAlarms.length === 0) ||
                (activeTab === 'deadlines' && (deliveryAlarms.length + pendingOrders.length) === 0)) && (
                <div className="p-8 text-center flex flex-col items-center justify-center gap-2 select-none min-h-[14rem]">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 text-lg">
                    🎉
                  </div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                    Aucune alerte en attente !
                  </h4>
                  <p className="text-[10px] text-slate-500 leading-relaxed max-w-[240px]">
                    {activeTab === 'relances'
                      ? "Aucun prospect à relancer — ton pipeline est chaud et frais. 🔥"
                      : activeTab === 'purchases'
                        ? "Aucun suivi post-achat dû — tes clients sont accompagnés comme il se doit. ✨"
                      : activeTab === 'followups'
                        ? "Tous vos rendez-vous clients et appels de prospection sont à jour."
                        : activeTab === 'deadlines'
                          ? "Aucune commande en suspens ni livraison en retard pour le moment."
                          : "Parfait ! Vos suivis d'activité, rendez-vous et commandes sont impeccablement gérés."}
                  </p>
                </div>
              )}

              {/* A-bis. RELANCES PROSPECTS — design premium */}
              {(activeTab === 'all' || activeTab === 'relances') && activeRelances.map(r => {
                const isLate = r.urgency === 'late';
                const isDue = r.urgency === 'due';
                const phone = r.customer.phone || '';
                return (
                  <div
                    key={`notify_relance_${r.customer.id}`}
                    className={`p-3.5 hover:bg-slate-50/70 dark:hover:bg-[#25252a]/40 transition-colors relative border-l-4 ${
                      isLate ? 'border-l-rose-500 bg-rose-500/5' : isDue ? 'border-l-amber-400 bg-amber-500/5' : 'border-l-sky-400'
                    }`}
                    id={`notify_relance_row_${r.customer.id}`}
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Avatar initiales */}
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-black text-xs ${
                        isLate
                          ? 'bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-sm shadow-rose-500/30'
                          : isDue
                            ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm shadow-amber-500/30'
                            : 'bg-gradient-to-br from-sky-400 to-blue-500 text-white shadow-sm shadow-sky-500/30'
                      }`}>
                        {r.customer.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[9.5px] font-black uppercase px-2 py-0.5 rounded-md ${
                            isLate ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                              : isDue ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                : 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                          }`}>
                            {r.label}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                            {stageLabel(r.customer.pipelineStage)}
                          </span>
                        </div>

                        <p className="text-[13px] font-bold text-slate-900 dark:text-slate-100 mt-1 truncate">
                          {r.customer.name}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate">
                          Dernier contact : {r.customer.lastContactDate || 'jamais'} · il y a {r.daysSinceContact > 900 ? '?' : r.daysSinceContact} j
                        </p>

                        {/* Actions rapides */}
                        <div className="flex items-center gap-1.5 mt-2">
                          <a
                            href={`https://wa.me/${(() => {
                              let c = phone.replace(/[^0-9]/g, '');
                              if (c.startsWith('00')) c = c.substring(2);
                              if (c.length === 9 && (c.startsWith('05') || c.startsWith('06'))) return '242' + c.substring(1);
                              if ((c.length === 9 || c.length === 8)) return '242' + c.replace(/^[456]/, '');
                              return c;
                            })()}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => handleMarkContacted(r)}
                            className="py-1.5 px-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[10px] font-black flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                            title="Relancer sur WhatsApp (marque contacté)"
                          >
                            <MessageCircle className="w-3 h-3" />
                            WhatsApp
                          </a>
                          <a
                            href={`tel:${phone}`}
                            onClick={() => handleMarkContacted(r)}
                            className="py-1.5 px-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-black flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                            title="Appeler (marque contacté)"
                          >
                            <Phone className="w-3 h-3" />
                            Appeler
                          </a>
                          <button
                            onClick={() => navigate('/prospects')}
                            className="py-1.5 px-2 text-slate-400 hover:text-amber-500 rounded-lg text-[10px] font-bold flex items-center gap-0.5 active:scale-95 transition-all cursor-pointer"
                            title="Ouvrir le pipeline prospects"
                          >
                            Fiche
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* A-ter. SUIVIS POST-ACHAT (J+3 / J+7 / J+10) */}
              {(activeTab === 'all' || activeTab === 'purchases') && duePurchaseFollowUps.map(fu => {
                const cust = fu.customer;
                const phone = cust?.phone || '';
                const isDueNow = fu.urgency === 'due';
                return (
                  <div
                    key={`notify_purchase_${fu.order.id}`}
                    className={`p-3.5 hover:bg-slate-50/70 dark:hover:bg-[#25252a]/40 transition-colors relative border-l-4 ${
                      isDueNow ? 'border-l-emerald-500 bg-emerald-500/5' : 'border-l-violet-400 bg-violet-500/5'
                    }`}
                    id={`notify_purchase_row_${fu.order.id}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white text-sm shadow-sm ${
                        isDueNow
                          ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30'
                          : 'bg-gradient-to-br from-violet-500 to-purple-600 shadow-violet-500/30'
                      }`}>
                        🛒
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[9.5px] font-black uppercase px-2 py-0.5 rounded-md ${
                            isDueNow ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-violet-500/10 text-violet-600 dark:text-violet-400'
                          }`}>
                            {fu.milestone} · {fu.title}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400">
                            {cust?.name || fu.order.customerName}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-snug">
                          {fu.message}
                        </p>
                        <p className="text-[9px] text-slate-400 mt-0.5">
                          {fu.order.refCommande || fu.order.id} · achat le {purchaseAnchorDate(fu.order)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* LIST ITEMS */}

              {/* A. RENDER PENDING ORDERS DEADLINES */}
              {(activeTab === 'all' || activeTab === 'deadlines') && pendingOrders.map(order => {
                const daysPending = getDaysPending(order.date);
                const isUrgent = daysPending >= 2;
                const clientObj = getContactInfo(order.customerName);
                const resolvedPhone = clientObj?.phone || '';

                return (
                  <div 
                    key={`notify_order_${order.id}`} 
                    className={`p-3.5 hover:bg-slate-50/70 dark:hover:bg-[#25252a]/40 transition-colors space-y-2.5 relative border-l-4 ${
                      isUrgent ? 'border-l-rose-500 bg-rose-500/5' : 'border-l-amber-400'
                    }`}
                    id={`notify_order_row_${order.id}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center mt-0.5 shrink-0">
                        <ShoppingBag className="w-4 h-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[9.5px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            Commande En Attente
                          </span>
                          <span className="text-[9.5px] font-bold text-slate-400 flex items-center gap-0.5 select-none">
                            <Clock className="w-3 h-3" />
                            Placée le {order.date}
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-50 leading-tight mt-1">
                          Commande de <strong className="text-amber-600 dark:text-amber-400">{order.customerName}</strong>
                        </h4>

                        <p className="text-[10px] text-slate-500 truncate mt-0.5">
                          {order.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                        </p>
                        
                        <p className="text-[9.5px] font-bold text-slate-600 dark:text-slate-350 mt-1">
                          Valeur : <span className="text-slate-900 dark:text-slate-100 font-extrabold">{order.totalRetail.toLocaleString()} F</span> ({order.totalCC.toFixed(3)} CC)
                        </p>

                        {/* Urgent timer alarm */}
                        <div className="mt-2 flex items-center gap-1 text-[9.5px] font-black uppercase text-rose-500 bg-rose-500/10 py-1 px-2.5 rounded-lg w-max">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {daysPending === 0 
                              ? "Commandée Aujourd'hui — Valider sous 72h" 
                              : `En suspens depuis ${daysPending} jour(s) — Délai limite`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Transaction Quick Controls */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100/50 dark:border-slate-800/50 pl-9">
                      <span className="text-[10px] text-slate-400 font-medium">Actions directes :</span>
                      <div className="flex items-center gap-1.5">
                        {resolvedPhone && (
                          <>
                            <a
                              href={`tel:${resolvedPhone}`}
                              className="w-7 h-7 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center active:scale-95 transition-all border border-amber-200/20"
                              title="Appeler le client"
                              id={`call_order_customer_btn_${order.id}`}
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                            <a
                              href={`https://wa.me/${cleanPhoneForWhatsApp(resolvedPhone)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-7 h-7 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-[#1a412c]/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center active:scale-95 transition-all border border-emerald-200/20"
                              title="WhatsApp client"
                              id={`whatsapp_order_customer_btn_${order.id}`}
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                          </>
                        )}
                        <button
                          onClick={() => handleValidateOrder(order)}
                          className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-black uppercase text-[9px] rounded-lg shadow-sm transition-all flex items-center gap-0.5 cursor-pointer h-7"
                          title="Valider la commande et l'inscrire au chiffre d'affaires"
                          id={`validate_order_btn_${order.id}`}
                        >
                          <Check className="w-3 h-3" />
                          Valider
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}


              {/* B. RENDER DELIVERY AGENDA REMINDERS */}
              {(activeTab === 'all' || activeTab === 'deadlines') && deliveryAlarms.map(item => {
                const isOverdue = item.date < todayStr;
                return (
                  <div 
                    key={`notify_delivery_${item.id}`}
                    className={`p-3.5 hover:bg-slate-50/70 dark:hover:bg-[#25252a]/40 transition-colors space-y-2.5 border-l-4 border-l-blue-500 ${isOverdue ? 'bg-rose-500/5' : ''}`}
                    id={`notify_delivery_row_${item.id}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <button
                        onClick={() => toggleAgendaItemCompleted(item.id)}
                        className="mt-0.5 w-5 h-5 rounded-full border border-slate-300 dark:border-slate-700 hover:border-emerald-500 flex items-center justify-center group active:scale-90 transition-all cursor-pointer shrink-0"
                        title="Marquer la livraison comme exécutée"
                        id={`complete_delivery_btn_${item.id}`}
                      >
                        <Check className="w-3 h-3 text-transparent group-hover:text-emerald-500 transition-colors" />
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[9.5px] font-black uppercase px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            Livraison Client
                          </span>
                          <span className={`text-[9.5px] font-extrabold flex items-center gap-0.5 px-2 py-0.5 rounded-md ${
                            isOverdue ? 'bg-rose-500/10 text-rose-500' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                          }`}>
                            <AlertCircle className="w-3 h-3" />
                            {isOverdue ? "RETARD" : item.date === todayStr ? "AUJOURD'HUI" : item.date}
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-50 leading-tight mt-1 truncate">
                          {item.title}
                        </h4>

                        {item.notes && (
                          <p className="text-[10px] text-slate-500 italic mt-0.5 truncate">
                            "{item.notes}"
                          </p>
                        )}
                        
                        {item.contactName && (
                          <div className="mt-1 text-[10px] text-slate-600 dark:text-slate-400 font-semibold truncate">
                            FBO Livraison : <strong className="text-slate-800 dark:text-slate-200">{item.contactName}</strong>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions and Snooze */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100/50 dark:border-slate-800/50 pl-7.5">
                      <span className="text-[10px] text-slate-400 font-medium">Rappels :</span>
                      <div className="flex items-center gap-1">
                        {item.contactPhone && (
                          <>
                            <a
                              href={`tel:${item.contactPhone}`}
                              className="w-7 h-7 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center active:scale-95 transition-all"
                              title="Appeler"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                            <a
                              href={`https://wa.me/${cleanPhoneForWhatsApp(item.contactPhone)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-7 h-7 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-[#1a412c]/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center active:scale-95 transition-all"
                              title="WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                          </>
                        )}
                        <button
                          onClick={() => handleSnooze(item)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white text-slate-600 dark:text-slate-350 font-black uppercase text-[9px] rounded-lg transition-all cursor-pointer h-7"
                          title="Snoozer (Reporter à demain)"
                          id={`snooze_delivery_btn_${item.id}`}
                        >
                          Snoozer
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}


              {/* C. RENDER FOLLOW-UP AGENDA REMINDERS */}
              {(activeTab === 'all' || activeTab === 'followups') && followUpAlarms.map(item => {
                const isOverdue = item.date < todayStr;
                return (
                  <div 
                    key={`notify_followup_${item.id}`}
                    className={`p-3.5 hover:bg-slate-50/70 dark:hover:bg-[#25252a]/40 transition-colors space-y-2.5 border-l-4 border-l-amber-500 ${isOverdue ? 'bg-amber-500/5' : ''}`}
                    id={`notify_followup_row_${item.id}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <button
                        onClick={() => toggleAgendaItemCompleted(item.id)}
                        className="mt-0.5 w-5 h-5 rounded-full border border-slate-300 dark:border-slate-700 hover:border-emerald-500 flex items-center justify-center group active:scale-90 transition-all cursor-pointer shrink-0"
                        title="Marquer le suivi comme accompli"
                        id={`complete_followup_btn_${item.id}`}
                      >
                        <Check className="w-3 h-3 text-transparent group-hover:text-emerald-500 transition-colors" />
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[9.5px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            {item.type === 'PRESENTATION' ? 'Présentation FLP' : 'Suivi Prospect'}
                          </span>
                          <span className={`text-[9.5px] font-extrabold flex items-center gap-0.5 px-2 py-0.5 rounded-md ${
                            isOverdue ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-600'
                          }`}>
                            <Clock className="w-3 h-3" />
                            {isOverdue ? "EN RETARD" : "CE JOUR"}
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-50 leading-tight mt-1 truncate">
                          {item.title}
                        </h4>

                        {item.notes && (
                          <p className="text-[10px] text-slate-500 italic mt-0.5 truncate">
                            "{item.notes}"
                          </p>
                        )}
                        
                        {item.contactName && (
                          <div className="mt-1 text-[10px] text-slate-600 dark:text-slate-400 font-semibold truncate">
                            Client/Prospect : <strong className="text-slate-800 dark:text-slate-200">{item.contactName}</strong>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Direct calling and snooze */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100/50 dark:border-slate-800/50 pl-7.5">
                      <span className="text-[10px] text-slate-400 font-medium">Actions :</span>
                      <div className="flex items-center gap-1">
                        {item.contactPhone && (
                          <>
                            <a
                              href={`tel:${item.contactPhone}`}
                              className="w-7 h-7 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center active:scale-95 transition-all"
                              title="Appeler"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                            <a
                              href={`https://wa.me/${cleanPhoneForWhatsApp(item.contactPhone)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-7 h-7 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-[#1a412c]/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center active:scale-95 transition-all"
                              title="WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                          </>
                        )}
                        <button
                          onClick={() => handleSnooze(item)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white text-slate-600 dark:text-slate-350 font-black uppercase text-[9px] rounded-lg transition-all cursor-pointer h-7"
                          title="Snoozer (Reporter à demain)"
                          id={`snooze_followup_btn_${item.id}`}
                        >
                          Snoozer
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

            </div>

            {/* 4. Footer */}
            <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex gap-2">
              <button
                onClick={() => { setIsOpen(false); navigate('/agenda'); }}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1"
              >
                Planner
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => { setIsOpen(false); navigate('/orders'); }}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1"
              >
                Mes ventes
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* D. IMMERSIVE SLIDE-IN TOAST ALERT FOR OVERLAY NOTIFICATION */}
      <AnimatePresence>
        {showToast && alertsCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed left-3 right-3 xl:left-auto xl:right-6 xl:w-[380px] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-60"
            style={{ bottom: 'calc(72px + env(safe-area-inset-bottom, 8px) + 8px)' }}
            id="notification_slide_toast"
          >
            <div className="flex items-start gap-3 p-4 pb-2">
              <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0 mt-0.5">
                <Bell className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-0.5">
                  Priorité du jour
                </p>
                <p className="text-[13px] text-slate-300 leading-snug">
                  {alertsCount} rappel{alertsCount > 1 ? 's' : ''} ou délai{alertsCount > 1 ? 's' : ''} urgent{alertsCount > 1 ? 's' : ''} à traiter.
                </p>
              </div>
              <button
                onClick={() => setShowToast(false)}
                className="text-slate-500 hover:text-slate-200 transition-colors cursor-pointer p-1 -mr-1 -mt-0.5 shrink-0"
                id="notify_close_toast_btn"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2 px-4 pb-4">
              <button
                type="button"
                onClick={() => { setShowToast(false); setIsOpen(true); }}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold uppercase rounded-xl transition-all cursor-pointer tracking-wide"
              >
                Consulter
              </button>
              <button
                type="button"
                onClick={() => setShowToast(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white text-[11px] font-bold uppercase rounded-xl transition-all cursor-pointer tracking-wide"
              >
                Masquer
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};