import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './ProspectsClients.css';
import './ProspectsView.css';
import { useCustomersStore } from '../store/slices/customersSlice';
import { useAgendaStore } from '../store/slices/agendaSlice';
import { Card } from '../components/ui/Card';
import { Drawer } from '../components/ui/Drawer';
import { ProspectInteractionsSection } from '../components/ui/prospects/ProspectInteractionsSection';
import { ProspectConversionModal } from '../components/ui/prospects/ProspectConversionModal';
import { ConversionChannel, Customer, CustomerStatus, PipelineStage } from '../types';
import { useActionFeedback } from '../hooks/useActionFeedback';
import { localDateISO } from '../lib/orderStats';
import { formatDecimal, formatNumber } from '../lib/format';
import {
  CreateProspectInteractionInput,
  getEffectiveLastContactDate,
  maxIsoDate,
} from '../lib/prospectInteractions';
import {
  ComposedInteractionResult,
  executeComposedInteractionWithFollowUp,
  executeComposedProspectConversion,
} from '../lib/composedOperations';
import {
  computeAcquisitionSourceStats,
  computeChannelPerformanceStats,
  computeConversionFunnel,
  computeFollowUpSummary,
  computeProspectionOverviewKpis,
  type ProspectionPeriod,
} from '../lib/prospectionStats';
import {
  Phone,
  Mail,
  UserPlus,
  Search,
  Trash2,
  ChevronsRight,
  CalendarCheck,
  MessageCircle,
  Cake,
  Users,
  MapPin as MapPinIcon,
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle2,
  CalendarPlus,
  ExternalLink,
} from 'lucide-react';

const STAGES: { code: PipelineStage; label: string; desc: string; color: string }[] = [
  { code: 'CONTACT_INITIATED', label: 'Initié', desc: 'Contact pris', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' },
  { code: 'PRESENTATION_DONE', label: 'Présenté', desc: 'Présentation FLP faite', color: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400' },
  { code: 'FOLLOW_UP_REQUIRED', label: 'Relance', desc: 'Suivi requis', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' },
  { code: 'CLOSED_WON', label: 'Gagné (FBO/Client)', desc: 'Vente / Signature', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' },
  { code: 'CLOSED_LOST', label: 'Perdu / Standby', desc: 'Non intéressé', color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' }
];

const PERIOD_OPTIONS: [ProspectionPeriod, string][] = [
  ['all', 'Tout'],
  ['7', '7 jours'],
  ['30', '30 jours'],
  ['month', 'Ce mois'],
  ['90', '90 jours'],
  ['year', 'Cette année'],
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
      return '242' + cleaned;
    }
  } else if (cleaned.length === 8) {
    if (cleaned.startsWith('6') || cleaned.startsWith('5') || cleaned.startsWith('4')) {
      return '242' + cleaned;
    }
  }
  return cleaned;
};

export const ProspectsView: React.FC = () => {
  const navigate = useNavigate();
  const { customers, addCustomer, updateCustomer, addProspectInteraction, deleteCustomer } =
    useCustomersStore();
  const { agendaList, addAgendaItem, toggleAgendaItemCompleted } = useAgendaStore();
  const { executeAction, confirmAction, isActionPending, notifyError, notifyWarning } =
    useActionFeedback();
  const isSubmitting = isActionPending('prospect-add');

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStage, setSelectedStage] = useState<PipelineStage | 'ALL'>('ALL');
  const [period, setPeriod] = useState<ProspectionPeriod>('all');
  const [followUpTab, setFollowUpTab] = useState<'actionable' | 'scheduled' | 'completed' | 'missing'>('actionable');

  // Drawer states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<Customer | null>(null);
  const [conversionTarget, setConversionTarget] = useState<Customer | null>(null);

  const liveSelectedProspect = useMemo(() => {
    if (!selectedProspect) return null;
    return customers.find((c) => c.id === selectedProspect.id) ?? selectedProspect;
  }, [customers, selectedProspect]);

  // Quick follow-up scheduling drawer state
  const [followUpTarget, setFollowUpTarget] = useState<Customer | null>(null);
  const [followUpTitle, setFollowUpTitle] = useState('');
  const [followUpDate, setFollowUpDate] = useState(() => localDateISO());
  const [followUpTime, setFollowUpTime] = useState('10:00');
  const [followUpNotes, setFollowUpNotes] = useState('');

  // New Prospect Fields
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newVille, setNewVille] = useState('');
  const [newDateNaissance, setNewDateNaissance] = useState('');
  const [newSourceProspection, setNewSourceProspection] = useState<'META_ADS' | 'RECOMMANDATION' | 'BOUCHE_OREILLE' | 'EVENEMENT' | 'AUTRE'>('AUTRE');
  const [newNotes, setNewNotes] = useState('');
  const [newStage, setNewStage] = useState<PipelineStage>('CONTACT_INITIATED');

  const todayStr = localDateISO();

  const kpis = useMemo(
    () => computeProspectionOverviewKpis(customers, agendaList, period, todayStr),
    [customers, agendaList, period, todayStr],
  );
  const channelStats = useMemo(
    () => computeChannelPerformanceStats(customers, period, todayStr),
    [customers, period, todayStr],
  );
  const acquisitionStats = useMemo(
    () => computeAcquisitionSourceStats(customers, period, todayStr),
    [customers, period, todayStr],
  );
  const funnelSummary = useMemo(
    () => computeConversionFunnel(customers, period, todayStr, 7),
    [customers, period, todayStr],
  );
  const followUpSummary = useMemo(
    () => computeFollowUpSummary(customers, agendaList, todayStr),
    [customers, agendaList, todayStr],
  );

  // Filter active prospects for operational list
  const prospects = customers.filter(c => c.status === CustomerStatus.PROSPECT);

  const filteredProspects = prospects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.phone.includes(searchTerm) || 
                          (p.notes && p.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStage = selectedStage === 'ALL' || p.pipelineStage === selectedStage;
    return matchesSearch && matchesStage;
  });

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) {
      notifyError('Veuillez renseigner le nom et le numéro de téléphone du prospect.');
      return;
    }

    await executeAction({
      actionKey: 'prospect-add',
      operation: () =>
        addCustomer({
          name: newName,
          email: newEmail,
          phone: newPhone,
          address: newAddress,
          ville: newVille,
          dateNaissance: newDateNaissance,
          sourceProspection: newSourceProspection,
          recordOrigin: 'PROSPECTION',
          status: CustomerStatus.PROSPECT,
          pipelineStage: newStage,
          lastContactDate: new Date().toISOString().split('T')[0],
          notes: newNotes
        }),
      successMessage: 'Prospect ajouté avec succès !',
      queuedMessage: 'Prospect enregistré hors-ligne (en attente de synchronisation).',
      errorContext: "Échec de l'enregistrement du prospect",
      redirectToDashboard: true,
      onSuccess: () => {
        setNewName('');
        setNewEmail('');
        setNewPhone('');
        setNewAddress('');
        setNewVille('');
        setNewDateNaissance('');
        setNewSourceProspection('AUTRE');
        setNewNotes('');
        setNewStage('CONTACT_INITIATED');
        setIsAddOpen(false);
      },
    });
  };

  const handleStageChange = async (prospect: Customer, nextStage: PipelineStage) => {
    const todayDate = localDateISO();
    const monotonicLast = maxIsoDate(prospect.lastContactDate, todayDate) || todayDate;
    await executeAction({
      actionKey: `prospect-stage-${prospect.id}`,
      operation: () =>
        updateCustomer({
          ...prospect,
          recordOrigin: prospect.recordOrigin ?? 'PROSPECTION',
          pipelineStage: nextStage,
          lastContactDate: monotonicLast,
        }),
      successMessage: 'Statut du prospect mis à jour avec succès !',
      queuedMessage: 'Statut mis à jour hors-ligne (en attente de synchronisation).',
      errorContext: 'Échec de la mise à jour du prospect',
      redirectToDashboard: false,
      onSuccess: () => {
        if (selectedProspect && selectedProspect.id === prospect.id) {
          setSelectedProspect((prev) =>
            prev ? { ...prev, pipelineStage: nextStage, lastContactDate: monotonicLast } : null,
          );
        }
        setIsDetailOpen(false);
      },
    });
  };

  const handleAddInteraction = async ({
    customerId,
    input,
    alreadyCommittedInteraction,
    createAgendaFollowUp,
  }: {
    customerId: string;
    input: CreateProspectInteractionInput;
    alreadyCommittedInteraction: boolean;
    createAgendaFollowUp: boolean;
  }): Promise<{ ok: boolean; interactionCommitted: boolean }> => {
    const target = customers.find((c) => c.id === customerId) ?? liveSelectedProspect;
    let composed: ComposedInteractionResult | null = null;
    const stableInteractionId = (input.id || '').trim() || `int_${Date.now().toString(36)}`;

    const outcome = await executeAction({
      actionKey: `prospect-interaction-${customerId}`,
      operation: async () => {
        composed = await executeComposedInteractionWithFollowUp({
          customerId,
          customerName: target?.name || 'Prospect',
          customerPhone: target?.phone || '',
          stableInteractionId,
          alreadyCommittedInteraction,
          input,
          createAgendaFollowUp,
          addProspectInteraction,
          addAgendaItem,
        });
        return composed.overallPersistence;
      },
      successMessage: 'Interaction enregistrée dans le journal !',
      queuedMessage: 'Interaction enregistrée hors-ligne (en attente de synchronisation).',
      errorContext: "Échec de l'enregistrement de l'interaction",
      redirectToDashboard: false,
      getPartialWarning: () =>
        composed?.hasPartialAgendaFailure
          ? `Interaction ${composed.interactionStatus === 'queued' ? 'mise en file hors-ligne' : 'enregistrée'}, mais la relance Agenda a échoué (${composed.agendaError || 'erreur'}). Planifiez-la séparément si nécessaire.`
          : undefined,
    });
    return {
      ok: outcome.ok,
      interactionCommitted: Boolean(outcome.ok && composed),
    };
  };

  const handleConfirmConversion = async ({
    prospect,
    conversionChannel,
    convertedAt,
    logConversionInteraction,
  }: {
    prospect: Customer;
    conversionChannel: ConversionChannel;
    convertedAt: string;
    logConversionInteraction: boolean;
  }) => {
    const liveProspect = customers.find((c) => c.id === prospect.id) ?? prospect;
    if (liveProspect.status === CustomerStatus.CLIENT) {
      notifyWarning('Ce prospect est déjà converti en client.');
      setConversionTarget(null);
      return;
    }

    await executeAction({
      actionKey: `prospect-convert-${liveProspect.id}`,
      operation: async () => {
        const composed = await executeComposedProspectConversion({
          prospect: liveProspect,
          conversionChannel,
          convertedAt,
          logConversionInteraction,
          addProspectInteraction,
          updateCustomer,
        });
        return composed.overallPersistence;
      },
      successMessage: 'Prospect converti en client avec succès !',
      queuedMessage: 'Conversion enregistrée hors-ligne (en attente de synchronisation).',
      errorContext: 'Échec de la conversion du prospect',
      redirectToDashboard: false,
      onSuccess: () => {
        setConversionTarget(null);
        setIsDetailOpen(false);
        setSelectedProspect(null);
      },
    });
  };

  const handleDeleteProspect = async (prospect: Customer) => {
    const confirmed = await confirmAction({
      title: 'Supprimer le prospect',
      message: `Supprimer définitivement ${prospect.name} de votre base de données ?`,
      confirmLabel: 'Oui, supprimer',
      cancelLabel: 'Annuler',
      tone: 'danger',
    });
    if (!confirmed) return;

    await executeAction({
      actionKey: `prospect-delete-${prospect.id}`,
      operation: () => deleteCustomer(prospect.id),
      successMessage: 'Prospect supprimé avec succès !',
      errorContext: 'Échec de la suppression du prospect',
      redirectToDashboard: true,
      onSuccess: () => {
        setIsDetailOpen(false);
        setSelectedProspect(null);
      },
    });
  };

  const openFollowUpDrawer = (prospect: Customer) => {
    setFollowUpTarget(prospect);
    setFollowUpTitle(`Relancer ${prospect.name}`);
    setFollowUpDate(localDateISO());
    setFollowUpTime('10:00');
    setFollowUpNotes('');
  };

  const handleCreateFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpTarget) return;
    if (!followUpTitle.trim() || !followUpDate) {
      notifyError('Veuillez renseigner un titre et une date de relance.');
      return;
    }

    await executeAction({
      actionKey: `prospect-schedule-${followUpTarget.id}`,
      operation: () =>
        addAgendaItem({
          title: followUpTitle.trim(),
          date: followUpDate,
          time: followUpTime || '10:00',
          type: 'FOLLOW_UP',
          customerId: followUpTarget.id,
          contactName: followUpTarget.name,
          contactPhone: followUpTarget.phone,
          notes: followUpNotes.trim() || undefined,
        }),
      successMessage: `Relance planifiée pour ${followUpTarget.name} !`,
      queuedMessage: 'Relance enregistrée hors-ligne (en attente de synchronisation).',
      errorContext: 'Échec de la planification de la relance',
      redirectToDashboard: false,
      onSuccess: () => {
        setFollowUpTarget(null);
      },
    });
  };

  const handleToggleFollowUpDone = async (itemId: string) => {
    await executeAction({
      actionKey: `prospect-followup-toggle-${itemId}`,
      operation: () => toggleAgendaItemCompleted(itemId),
      successMessage: 'Statut de la relance mis à jour !',
      errorContext: 'Échec de la mise à jour de la relance',
      redirectToDashboard: false,
    });
  };

  return (
    <div className="crm-view prospects-view" id="prospects_view_container">
      
      {/* 1. Header Row */}
      <div className="crm-page-header">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Pilotage Prospection FLP</h2>
          <p className="text-xs text-slate-500">Indicateurs, sources d'acquisition, entonnoir et suivi des relances.</p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="py-3 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-2xl active:scale-95 transition-all flex items-center gap-2 shrink-0 h-12"
          id="prospect_add_new_btn" aria-label="Ajouter un prospect"
        >
          <UserPlus className="w-4 h-4" />
          AJOUTER UN PROSPECT
        </button>
      </div>

      {/* 1b. Période d'acquisition de la cohorte */}
      <div className="prospects-period-bar">
        <span className="prospects-period-label">Période d'acquisition des prospects</span>
        <div className="prospects-period-control" role="group" aria-label="Période d'acquisition des prospects" id="prospects_period_control">
          {PERIOD_OPTIONS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={period === value ? 'is-active' : ''}
              onClick={() => setPeriod(value)}
              aria-pressed={period === value}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 1c. Tableau de bord KPI général */}
      <section className="prospects-kpi-grid" id="prospects_kpi_grid" aria-label="Indicateurs clés de prospection">
        <article className="prospects-kpi-card">
          <div className="prospects-kpi-head">
            <span>Prospects inscrits sur la période</span>
            <Users size={15} className="prospects-kpi-ico is-blue" />
          </div>
          <strong className="prospects-kpi-val">{formatNumber(kpis.totalProspects)} prospects</strong>
          <small className="prospects-kpi-sub">
            {formatNumber(kpis.activeProspects)} actifs · {formatNumber(kpis.newRegistrations)} nouveaux ({kpis.newRegistrationsHint})
          </small>
        </article>

        <article className="prospects-kpi-card">
          <div className="prospects-kpi-head">
            <span>Contactés & Réponses</span>
            <MessageCircle size={15} className="prospects-kpi-ico is-gold" />
          </div>
          <strong className="prospects-kpi-val">
            {kpis.responseRatePct !== null
              ? `${formatDecimal(kpis.responseRatePct)} % rép.`
              : `${formatNumber(kpis.contactedCount)} contactés`}
          </strong>
          <small className="prospects-kpi-sub">
            {kpis.responseRatePct !== null && kpis.respondedCount !== null
              ? `${formatNumber(kpis.respondedCount)}/${formatNumber(kpis.interactionContactedCount)} prospects avec réponse · ${formatNumber(kpis.contactedCount)} contactés`
              : `${formatNumber(kpis.contactedCount)} contactés · Réponses : Données insuffisantes`}
          </small>
        </article>

        <article className="prospects-kpi-card">
          <div className="prospects-kpi-head">
            <span>Présentations & Relances</span>
            <Clock size={15} className="prospects-kpi-ico is-violet" />
          </div>
          <strong className="prospects-kpi-val">{formatNumber(kpis.presentationsCount)} présent.</strong>
          <small className="prospects-kpi-sub">
            {formatNumber(kpis.waitingFollowUpCount)} en attente ·{' '}
            <span className={kpis.overdueFollowUpsCount > 0 ? 'is-danger-text' : ''}>
              {formatNumber(kpis.overdueFollowUpsCount)} en retard (Agenda)
            </span>
          </small>
        </article>

        <article className="prospects-kpi-card">
          <div className="prospects-kpi-head">
            <span>Prospects convertis de la cohorte</span>
            <TrendingUp size={15} className="prospects-kpi-ico is-emerald" />
          </div>
          <strong className="prospects-kpi-val">{formatNumber(kpis.convertedCount)} convertis</strong>
          <small className="prospects-kpi-sub">
            Taux de cohorte :{' '}
            {kpis.conversionRatePct !== null
              ? `${formatDecimal(kpis.conversionRatePct)} %`
              : 'Données insuffisantes'}
            {kpis.conversionsInPeriodByConvertedAtCount > 0
              ? ` · ${formatNumber(kpis.conversionsInPeriodByConvertedAtCount)} datée${kpis.conversionsInPeriodByConvertedAtCount > 1 ? 's' : ''} sur la période`
              : ''}
          </small>
        </article>
      </section>

      {kpis.unattributedHistoricalClientsCount > 0 && (
        <p className="prospects-cohort-note" id="prospects_unattributed_note">
          {formatNumber(kpis.unattributedHistoricalClientsCount)} fiche
          {kpis.unattributedHistoricalClientsCount > 1 ? 's' : ''} client historique
          {kpis.unattributedHistoricalClientsCount > 1 ? 's' : ''} sans traçabilité d'origine (clients directs
          ou conversions antérieures non attribuables) : exclue
          {kpis.unattributedHistoricalClientsCount > 1 ? 's' : ''} du taux de conversion de la cohorte.
        </p>
      )}

      {/* 1d-bis. Performance par canal de contact (Étape 2) */}
      <section
        className="prospects-panel"
        id="prospects_channels_panel"
        aria-label="Performance par canal de contact"
      >
        <header className="prospects-panel-header">
          <div>
            <span className="prospects-panel-eyebrow">INTERACTIONS & ATTRIBUTION (COHORTE)</span>
            <h3>Performance par canal de contact</h3>
          </div>
          <small>
            Unicité prospect par canal ·{' '}
            {formatNumber(channelStats.totalContactedWithInteractions)}/
            {formatNumber(channelStats.totalCohortProspects)} avec journal
          </small>
        </header>

        <div className="prospects-channel-grid">
          {channelStats.rows.map((row) => (
            <div
              key={row.channel}
              className="prospects-channel-card"
              id={`prospects_channel_card_${row.channel}`}
            >
              <div className="prospects-channel-top">
                <div className="prospects-source-title">
                  <span className="prospects-source-rank">{row.rank ? `#${row.rank}` : '—'}</span>
                  <strong>{row.label}</strong>
                </div>
                <span className="prospects-channel-contacts">
                  {formatNumber(row.contactedProspectsCount)} prospect
                  {row.contactedProspectsCount > 1 ? 's' : ''}
                </span>
              </div>

              <div className="prospects-channel-rates">
                <div>
                  <span>Taux de réponse</span>
                  <strong>
                    {row.responseRatePct !== null
                      ? `${formatDecimal(row.responseRatePct)} %`
                      : 'Données insuffisantes'}
                  </strong>
                  <small>
                    {row.contactedProspectsCount > 0
                      ? `${formatNumber(row.respondedProspectsCount)}/${formatNumber(row.contactedProspectsCount)} rép.`
                      : '0 contact'}
                  </small>
                </div>
                <div>
                  <span>Taux de conversion</span>
                  <strong className={row.conversionRatePct !== null && row.conversionRatePct > 0 ? 'is-emerald' : ''}>
                    {row.conversionRatePct !== null
                      ? `${formatDecimal(row.conversionRatePct)} %`
                      : 'Données insuffisantes'}
                  </strong>
                  <small>
                    {row.contactedProspectsCount > 0
                      ? `${formatNumber(row.convertedProspectsCount)}/${formatNumber(row.contactedProspectsCount)} conv.`
                      : '0 contact'}
                  </small>
                </div>
              </div>
            </div>
          ))}
        </div>

        {(channelStats.unknownChannelConversionsCount > 0 ||
          channelStats.attributedWithoutChannelInteractionCount > 0) && (
          <p className="prospects-cohort-note">
            {channelStats.unknownChannelConversionsCount > 0 && (
              <>
                {formatNumber(channelStats.unknownChannelConversionsCount)} conversion
                {channelStats.unknownChannelConversionsCount > 1 ? 's' : ''} sans attribution de
                canal (« Inconnu » ou historique) incluse
                {channelStats.unknownChannelConversionsCount > 1 ? 's' : ''} dans le total cohorte.{' '}
              </>
            )}
            {channelStats.attributedWithoutChannelInteractionCount > 0 && (
              <>
                {formatNumber(channelStats.attributedWithoutChannelInteractionCount)} conversion
                {channelStats.attributedWithoutChannelInteractionCount > 1 ? 's' : ''} attribuée
                {channelStats.attributedWithoutChannelInteractionCount > 1 ? 's' : ''} sans
                interaction enregistrée sur le canal correspondant.
              </>
            )}
          </p>
        )}
      </section>

      {/* 1d. Sources d'acquisition & Entonnoir de conversion */}
      <div className="prospects-analytics-grid" id="prospects_analytics_grid">
        <section className="prospects-panel" id="prospects_acquisition_panel" aria-label="Performance des sources d'acquisition">
          <header className="prospects-panel-header">
            <div>
              <span className="prospects-panel-eyebrow">ACQUISITION (COHORTE)</span>
              <h3>Performance des sources d'acquisition</h3>
            </div>
            <small>Taux de conversion de la cohorte · hors canaux de contact</small>
          </header>

          <div className="prospects-source-list">
            {acquisitionStats.map((row) => (
              <div key={row.source} className="prospects-source-row">
                <div className="prospects-source-top">
                  <div className="prospects-source-title">
                    <span className="prospects-source-rank">{row.rank ? `#${row.rank}` : '—'}</span>
                    <strong>{row.label}</strong>
                  </div>
                  <span className="prospects-source-rate">
                    {row.conversionRatePct !== null
                      ? `${formatDecimal(row.conversionRatePct)} % conv.`
                      : 'Données insuffisantes'}
                  </span>
                </div>
                <div className="prospects-source-bar" aria-hidden="true">
                  <span
                    style={{
                      width: `${row.conversionRatePct !== null ? Math.min(100, Math.max(4, row.conversionRatePct)) : 0}%`,
                    }}
                  />
                </div>
                <div className="prospects-source-meta">
                  <span>{formatNumber(row.totalCount)} prospects</span>
                  <span>{formatNumber(row.presentationsCount)} présent.</span>
                  <span>{formatNumber(row.convertedCount)} convertis</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="prospects-panel" id="prospects_funnel_panel" aria-label="Entonnoir de conversion et stagnation">
          <header className="prospects-panel-header">
            <div>
              <span className="prospects-panel-eyebrow">PARCOURS & PERTES (COHORTE)</span>
              <h3>Entonnoir de conversion de la cohorte</h3>
            </div>
            <small>
              {funnelSummary.conversionRatePct !== null
                ? `${formatDecimal(funnelSummary.conversionRatePct)} % convertis · ${formatDecimal(funnelSummary.lossRatePct ?? 0)} % perdus`
                : 'Données insuffisantes'}
            </small>
          </header>

          <div className="prospects-funnel-list">
            {funnelSummary.stages.map((st) => (
              <div key={st.stage} className={`prospects-funnel-row is-${st.stage.toLowerCase()}`}>
                <div className="prospects-funnel-labels">
                  <strong>{st.label}</strong>
                  <span>
                    {formatNumber(st.count)} ·{' '}
                    {st.sharePct !== null ? `${formatDecimal(st.sharePct)} %` : 'Données insuffisantes'}
                  </span>
                </div>
                <div className="prospects-funnel-track" aria-hidden="true">
                  <span
                    style={{
                      width: `${st.sharePct !== null && st.count > 0 ? Math.min(100, Math.max(4, st.sharePct)) : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="prospects-stagnation-box">
            <div className="prospects-stagnation-head">
              <AlertTriangle size={13} />
              <strong>
                Prospects stagnants (≥ 7 j sans contact) : {formatNumber(funnelSummary.stagnatingProspects.length)}
              </strong>
            </div>
            {funnelSummary.stagnatingProspects.length === 0 ? (
              <p className="prospects-stagnation-empty">Aucun prospect stagnant détecté sur la période.</p>
            ) : (
              <div className="prospects-stagnation-items">
                {funnelSummary.stagnatingProspects.slice(0, 4).map(({ customer, daysSinceLastContact }) => (
                  <button
                    key={customer.id}
                    type="button"
                    className="prospects-stagnation-item"
                    onClick={() => {
                      setSelectedProspect(customer);
                      setIsDetailOpen(true);
                    }}
                  >
                    <span>{customer.name}</span>
                    <small>
                      {daysSinceLastContact !== null ? `${daysSinceLastContact} j` : 'Jamais contacté'}
                    </small>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 1e. Suivi opérationnel des relances synchronisé avec l'Agenda */}
      <section className="prospects-panel" id="prospects_followups_panel" aria-label="Suivi des relances">
        <header className="prospects-panel-header">
          <div>
            <span className="prospects-panel-eyebrow">SYNCHRONISÉ AVEC L'AGENDA</span>
            <h3>Suivi quotidien des relances</h3>
          </div>
          <button
            type="button"
            className="prospects-agenda-link"
            onClick={() => navigate('/agenda')}
          >
            Ouvrir l'Agenda
            <ExternalLink size={12} />
          </button>
        </header>

        <div className="prospects-followup-counters">
          <div className={`prospects-followup-stat ${followUpSummary.overdueCount > 0 ? 'is-danger' : ''}`}>
            <span>En retard</span>
            <strong>{formatNumber(followUpSummary.overdueCount)}</strong>
          </div>
          <div className="prospects-followup-stat is-today">
            <span>Aujourd'hui</span>
            <strong>{formatNumber(followUpSummary.todayCount)}</strong>
          </div>
          <div className="prospects-followup-stat">
            <span>Programmées</span>
            <strong>{formatNumber(followUpSummary.scheduledCount)}</strong>
          </div>
          <div className="prospects-followup-stat is-done">
            <span>Effectuées</span>
            <strong>{formatNumber(followUpSummary.completedCount)}</strong>
          </div>
          <div className="prospects-followup-stat is-warn">
            <span>Sans action</span>
            <strong>{formatNumber(followUpSummary.withoutNextActionCount)}</strong>
          </div>
        </div>

        <div className="prospects-followup-tabs" role="tablist" aria-label="Vues du suivi des relances">
          {(
            [
              ['actionable', `À traiter (${followUpSummary.overdueCount + followUpSummary.todayCount})`],
              ['scheduled', `Programmées (${followUpSummary.scheduledCount})`],
              ['completed', `Effectuées (${followUpSummary.completedCount})`],
              ['missing', `Sans prochaine action (${followUpSummary.withoutNextActionCount})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={followUpTab === key}
              className={followUpTab === key ? 'is-active' : ''}
              onClick={() => setFollowUpTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="prospects-followup-list">
          {followUpTab === 'actionable' && (
            <>
              {followUpSummary.overdueItems.length + followUpSummary.todayItems.length === 0 ? (
                <p className="prospects-followup-empty">Aucune relance due aujourd'hui ou en retard.</p>
              ) : (
                [...followUpSummary.overdueItems, ...followUpSummary.todayItems].map(({ item, matchedCustomer, daysOverdue }) => (
                  <div
                    key={item.id}
                    className={`prospects-followup-row ${daysOverdue > 0 ? 'is-overdue' : 'is-due'}`}
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleFollowUpDone(item.id)}
                      disabled={isActionPending(`prospect-followup-toggle-${item.id}`)}
                      className="prospects-followup-check"
                      aria-label={`Marquer la relance "${item.title}" comme effectuée`}
                    >
                      <CheckCircle2 size={16} />
                    </button>
                    <div className="prospects-followup-main">
                      <div className="prospects-followup-title-line">
                        <strong>{item.title}</strong>
                        <span className={`prospects-followup-status ${daysOverdue > 0 ? 'is-overdue' : 'is-today'}`}>
                          {daysOverdue > 0 ? `Retard ${daysOverdue} j` : "Aujourd'hui"}
                        </span>
                      </div>
                      <small>
                        {item.date} · {item.time}
                        {item.contactName ? ` · ${item.contactName}` : ''}
                      </small>
                    </div>
                    {matchedCustomer && (
                      <button
                        type="button"
                        className="prospects-followup-open"
                        onClick={() => {
                          setSelectedProspect(matchedCustomer);
                          setIsDetailOpen(true);
                        }}
                      >
                        Fiche
                      </button>
                    )}
                  </div>
                ))
              )}
            </>
          )}

          {followUpTab === 'scheduled' && (
            <>
              {followUpSummary.scheduledItems.length === 0 ? (
                <p className="prospects-followup-empty">Aucune relance future programmée.</p>
              ) : (
                followUpSummary.scheduledItems.map(({ item, matchedCustomer }) => (
                  <div key={item.id} className="prospects-followup-row">
                    <button
                      type="button"
                      onClick={() => handleToggleFollowUpDone(item.id)}
                      disabled={isActionPending(`prospect-followup-toggle-${item.id}`)}
                      className="prospects-followup-check"
                      aria-label={`Marquer la relance "${item.title}" comme effectuée`}
                    >
                      <CheckCircle2 size={16} />
                    </button>
                    <div className="prospects-followup-main">
                      <strong>{item.title}</strong>
                      <small>
                        {item.date} · {item.time}
                        {item.contactName ? ` · ${item.contactName}` : ''}
                      </small>
                    </div>
                    {matchedCustomer && (
                      <button
                        type="button"
                        className="prospects-followup-open"
                        onClick={() => {
                          setSelectedProspect(matchedCustomer);
                          setIsDetailOpen(true);
                        }}
                      >
                        Fiche
                      </button>
                    )}
                  </div>
                ))
              )}
            </>
          )}

          {followUpTab === 'completed' && (
            <>
              {followUpSummary.completedItems.length === 0 ? (
                <p className="prospects-followup-empty">Aucune relance marquée comme effectuée.</p>
              ) : (
                followUpSummary.completedItems.map(({ item }) => (
                  <div key={item.id} className="prospects-followup-row is-completed">
                    <CheckCircle2 size={16} className="prospects-followup-done-ico" />
                    <div className="prospects-followup-main">
                      <strong>{item.title}</strong>
                      <small>
                        {item.date} · {item.time}
                        {item.contactName ? ` · ${item.contactName}` : ''}
                      </small>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {followUpTab === 'missing' && (
            <>
              {followUpSummary.prospectsWithoutNextAction.length === 0 ? (
                <p className="prospects-followup-empty">Tous les prospects actifs ont une prochaine action définie.</p>
              ) : (
                followUpSummary.prospectsWithoutNextAction.map((pr) => (
                  <div key={pr.id} className="prospects-followup-row">
                    <div className="prospects-followup-main">
                      <strong>{pr.name}</strong>
                      <small>
                        {pr.phone} · Dernier contact : {pr.lastContactDate || 'aucun'}
                      </small>
                    </div>
                    <button
                      type="button"
                      className="prospects-schedule-btn"
                      onClick={() => openFollowUpDrawer(pr)}
                    >
                      <CalendarPlus size={13} />
                      Planifier
                    </button>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </section>

      {/* 2. Search & Stage Filter Chips (designed for thumb swiping) */}
      <div className="prospects-toolbar">
        {/* Search Input */}
        <div className="relative prospects-search-wrap">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
            <Search className="w-5 h-5" />
          </span>
          <input
            type="text"
            placeholder="Rechercher un prospect…"
            aria-label="Rechercher un prospect par nom, téléphone ou notes"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-[#1f1f22] border border-slate-200 dark:border-slate-800 rounded-2xl py-3 pl-11 pr-4 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all h-12"
            id="prospect_search_input"
          />
        </div>

        {/* Swipeable Horizontal Stage List */}
        <div className="prospect-stage-filters flex gap-2 mx-[-1rem] px-4 overflow-x-auto pb-1 scrollbar-none snap-x select-none">
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

      {/* Pipeline overview — counts remain derived from the existing prospect records. */}
      <section className="prospect-pipeline-overview" aria-label="Vue d'ensemble du pipeline">
        <div className="prospect-pipeline-heading">
          <div>
            <span>PIPELINE COMMERCIAL</span>
            <strong>Progression des prospects</strong>
          </div>
          <span className="prospect-pipeline-total">{prospects.length} au total</span>
        </div>
        <div className="prospect-pipeline-stages">
          {STAGES.map(stage => {
            const count = prospects.filter(prospect => prospect.pipelineStage === stage.code).length;
            const active = selectedStage === stage.code;
            return (
              <button
                key={stage.code}
                type="button"
                className={`prospect-pipeline-stage ${active ? 'is-active' : ''}`}
                onClick={() => setSelectedStage(active ? 'ALL' : stage.code)}
                aria-pressed={active}
              >
                <span>{stage.label}</span>
                <strong>{count}</strong>
                <small>{stage.desc}</small>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. Prospects Listing Cards (Optimized mobile alternative to a table) */}
      <div className="prospects-list" id="prospects_list_area">
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
                className="prospect-row hoverable active:scale-98 flex items-center justify-between gap-3 text-left p-4 rounded-3xl"
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
                    <span>Contact: {getEffectiveLastContactDate(pr) || pr.lastContactDate || 'aucun'}</span>
                    {(pr.interactions?.length ?? 0) > 0 && (
                      <span>· {pr.interactions!.length} interaction{pr.interactions!.length > 1 ? 's' : ''}</span>
                    )}
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
              placeholder="ex. Patrick Mouyabi"
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
                placeholder="ex. +242 06 xxx xxxx"
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Ville</label>
                        <input
                          type="text"
                          value={newVille}
                          onChange={(e) => setNewVille(e.target.value)}
                          placeholder="ex. Brazzaville"
                          className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Date Naissance</label>
                        <input
                          type="date"
                          value={newDateNaissance}
                          onChange={(e) => setNewDateNaissance(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Source Prospection</label>
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
            disabled={isSubmitting}
            className="w-full py-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed text-slate-950 font-black rounded-2xl shadow-lg active:scale-95 transition-all text-sm mt-4"
          >
            {isSubmitting ? 'ENREGISTREMENT...' : 'SAUVEGARDER LE PROSPECT'}
          </button>
        </form>
      </Drawer>

      {/* 5. DRAWER: DETAILS, INTERACTIONS & PIPELINE STATUS EDITING */}
      <Drawer
        isOpen={isDetailOpen && liveSelectedProspect !== null}
        onClose={() => {
          setIsDetailOpen(false);
        }}
        title={liveSelectedProspect?.name || 'Fiche Prospect'}
      >
        {liveSelectedProspect && (
          <div className="space-y-6">
            
            {/* Quick action shortcuts */}
            <div className="flex gap-2">
              <a
                href={`tel:${liveSelectedProspect.phone}`}
                className="flex-1 py-3 px-1 bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border border-slate-200/40 dark:border-slate-700/40"
              >
                <Phone className="w-4 h-4" />
                Appeler
              </a>
              <a
                href={`https://wa.me/${cleanPhoneForWhatsApp(liveSelectedProspect.phone)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3 px-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:hover:bg-emerald-900 dark:text-emerald-400 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border border-emerald-200/40 dark:border-emerald-800/20 active:scale-95 transition-all text-center"
              >
                <MessageCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                WhatsApp
              </a>
              <a
                href={`mailto:${liveSelectedProspect.email}`}
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
                            <span className="text-slate-800 dark:text-slate-200 font-semibold">{liveSelectedProspect.phone}</span>
                          </div>
                          {liveSelectedProspect.email && (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-slate-400 font-bold w-20 shrink-0">E-mail:</span>
                              <span className="text-slate-800 dark:text-slate-200 font-semibold truncate">{liveSelectedProspect.email}</span>
                            </div>
                          )}
                          {liveSelectedProspect.ville && (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-slate-400 font-bold w-20 shrink-0">
                                <MapPinIcon className="w-3.5 h-3.5" /> Ville:
                              </span>
                              <span className="text-slate-800 dark:text-slate-200 font-semibold truncate">{liveSelectedProspect.ville}</span>
                            </div>
                          )}
                          {liveSelectedProspect.address && (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-slate-400 font-bold w-20 shrink-0">Adresse:</span>
                              <span className="text-slate-800 dark:text-slate-200 font-semibold truncate">{liveSelectedProspect.address}</span>
                            </div>
                          )}
                          {liveSelectedProspect.dateNaissance && (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-slate-400 font-bold w-20 shrink-0">
                                <Cake className="w-3.5 h-3.5" /> Anniv.:
                              </span>
                              <span className="text-slate-800 dark:text-slate-200 font-semibold">{liveSelectedProspect.dateNaissance}</span>
                            </div>
                          )}
                          {liveSelectedProspect.sourceProspection && (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-slate-400 font-bold w-20 shrink-0">
                                <Users className="w-3.5 h-3.5" /> Source:
                              </span>
                              <span className="text-slate-800 dark:text-slate-200 font-semibold">{liveSelectedProspect.sourceProspection}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-slate-400 font-bold w-20 shrink-0">Créé le:</span>
                            <span className="text-slate-600 dark:text-slate-400 font-medium">{liveSelectedProspect.createdAt}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-slate-400 font-bold w-20 shrink-0">Dernier contact:</span>
                            <span className="text-slate-800 dark:text-slate-200 font-bold">
                              {getEffectiveLastContactDate(liveSelectedProspect) || liveSelectedProspect.lastContactDate}
                            </span>
                          </div>
                        </div>

            {/* Structured Interaction Journal (Étape 2) */}
            <ProspectInteractionsSection
              key={liveSelectedProspect.id}
              prospect={liveSelectedProspect}
              isSubmitting={isActionPending(`prospect-interaction-${liveSelectedProspect.id}`)}
              onAddInteraction={handleAddInteraction}
            />

            {/* Note Area */}
            <div>
              <h4 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Notes FLP</h4>
              <p className="text-sm text-slate-700 dark:text-slate-300 bg-amber-50/50 dark:bg-amber-950/15 border border-amber-200/50 dark:border-amber-800/20 p-3 rounded-2xl italic leading-relaxed">
                {liveSelectedProspect.notes || 'Aucune note additionnelle.'}
              </p>
            </div>

            {/* Step selection */}
            <div>
              <h4 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                Étape du Pipeline (Calcul direct)
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {STAGES.map(s => {
                  const active = liveSelectedProspect.pipelineStage === s.code;
                  return (
                    <button
                      key={s.code}
                      disabled={isActionPending(`prospect-stage-${liveSelectedProspect.id}`)}
                      onClick={() => handleStageChange(liveSelectedProspect, s.code)}
                      className={`py-2.5 px-3 rounded-xl text-left text-xs font-bold transition-all border disabled:opacity-60 ${
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

            {/* Primary transform converter: Transform as real Client via explicit attribution step */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsDetailOpen(false);
                  openFollowUpDrawer(liveSelectedProspect);
                }}
                className="w-full py-3 px-3 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-bold rounded-2xl transition-all text-xs flex items-center justify-center gap-2 border border-amber-200/60 dark:border-amber-800/40 cursor-pointer"
              >
                <CalendarCheck className="w-4 h-4" />
                Planifier une relance dans l'Agenda
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConversionTarget(liveSelectedProspect)}
                  disabled={isActionPending(`prospect-convert-${liveSelectedProspect.id}`)}
                  className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-extrabold rounded-2xl active:scale-95 transition-all text-xs flex items-center justify-center gap-2 cursor-pointer"
                  id="open_prospect_conversion_btn"
                >
                  <ChevronsRight className="w-5 h-5 animate-pulse" />
                  {isActionPending(`prospect-convert-${liveSelectedProspect.id}`) ? 'CONVERSION...' : 'CONVERTIR EN CLIENT FLP'}
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteProspect(liveSelectedProspect)}
                  disabled={isActionPending(`prospect-delete-${liveSelectedProspect.id}`)}
                  className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/40 disabled:opacity-50 rounded-2xl active:scale-95 transition-all text-xs border border-red-200/50 dark:border-red-900/30 shrink-0 cursor-pointer"
                  title="Supprimer"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>

          </div>
        )}
      </Drawer>

      {/* 5-bis. MODAL / DRAWER : ATTRIBUTION EXPLICITE DE CONVERSION */}
      <ProspectConversionModal
        prospect={conversionTarget}
        isOpen={conversionTarget !== null}
        isPending={
          conversionTarget !== null &&
          isActionPending(`prospect-convert-${conversionTarget.id}`)
        }
        onClose={() => setConversionTarget(null)}
        onConfirm={handleConfirmConversion}
      />

      {/* 6. DRAWER: PLANIFIER UNE RELANCE AGENDA */}
      <Drawer
        isOpen={followUpTarget !== null}
        onClose={() => setFollowUpTarget(null)}
        title={followUpTarget ? `Planifier relance · ${followUpTarget.name}` : 'Planifier une relance'}
      >
        {followUpTarget && (
          <form onSubmit={handleCreateFollowUp} className="space-y-4" id="prospect_schedule_followup_drawer">
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                Objet de la relance *
              </label>
              <input
                type="text"
                required
                value={followUpTitle}
                onChange={(e) => setFollowUpTitle(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  required
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  Heure
                </label>
                <input
                  type="time"
                  value={followUpTime}
                  onChange={(e) => setFollowUpTime(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                Notes
              </label>
              <textarea
                rows={3}
                value={followUpNotes}
                onChange={(e) => setFollowUpNotes(e.target.value)}
                placeholder="Objectif du prochain contact…"
                className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 text-[#101010] dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={isActionPending(`prospect-schedule-${followUpTarget.id}`)}
              className="w-full py-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-slate-950 font-black rounded-2xl active:scale-95 transition-all text-xs"
            >
              {isActionPending(`prospect-schedule-${followUpTarget.id}`)
                ? 'ENREGISTREMENT...'
                : "AJOUTER À L'AGENDA"}
            </button>
          </form>
        )}
      </Drawer>

    </div>
  );
};
