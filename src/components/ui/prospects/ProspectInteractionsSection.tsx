import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Customer,
  InteractionActionType,
  InteractionChannel,
  InteractionOutcome,
} from '../../../types';
import {
  CreateProspectInteractionInput,
  INTERACTION_ACTION_TYPES,
  INTERACTION_CHANNELS,
  INTERACTION_OUTCOMES,
  generateInteractionId,
  getInteractionActionLabel,
  getInteractionChannelLabel,
  getInteractionOutcomeLabel,
  isResponseOutcome,
} from '../../../lib/prospectInteractions';
import { localDateISO } from '../../../lib/orderStats';
import { CalendarPlus, MessageSquarePlus, Clock } from 'lucide-react';

interface ProspectInteractionsSectionProps {
  prospect: Customer;
  isSubmitting: boolean;
  onAddInteraction: (params: {
    customerId: string;
    input: CreateProspectInteractionInput;
    alreadyCommittedInteraction: boolean;
    createAgendaFollowUp: boolean;
  }) => Promise<{ ok: boolean; interactionCommitted: boolean }>;
}

export const ProspectInteractionsSection: React.FC<ProspectInteractionsSectionProps> = ({
  prospect,
  isSubmitting,
  onAddInteraction,
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [date, setDate] = useState(() => localDateISO());
  const [channel, setChannel] = useState<InteractionChannel>('WHATSAPP');
  const [actionType, setActionType] = useState<InteractionActionType>('PREMIER_CONTACT');
  const [outcome, setOutcome] = useState<InteractionOutcome>('SANS_REPONSE');
  const [notes, setNotes] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [createAgendaFollowUp, setCreateAgendaFollowUp] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const draftInteractionIdRef = useRef<string>(generateInteractionId());
  const committedInteractionIdRef = useRef<string | null>(null);
  const inFlightRef = useRef<boolean>(false);

  useEffect(() => {
    draftInteractionIdRef.current = generateInteractionId();
    committedInteractionIdRef.current = null;
    inFlightRef.current = false;
    setErrorMsg('');
  }, [prospect.id]);

  const orderedInteractions = useMemo(() => {
    const list = [...(prospect.interactions || [])];
    return list.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [prospect.interactions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || inFlightRef.current) return;
    inFlightRef.current = true;
    setErrorMsg('');
    const currentDraftId = draftInteractionIdRef.current;
    const alreadyCommitted = committedInteractionIdRef.current === currentDraftId;

    try {
      const res = await onAddInteraction({
        customerId: prospect.id,
        input: {
          id: currentDraftId,
          date,
          channel,
          actionType,
          outcome,
          notes,
          nextFollowUpDate: nextFollowUpDate || undefined,
        },
        alreadyCommittedInteraction: alreadyCommitted,
        createAgendaFollowUp: Boolean(nextFollowUpDate && createAgendaFollowUp),
      });
      if (res.interactionCommitted) {
        committedInteractionIdRef.current = currentDraftId;
      }
      if (res.ok) {
        setNotes('');
        setNextFollowUpDate('');
        setDate(localDateISO());
        setIsFormOpen(false);
        draftInteractionIdRef.current = generateInteractionId();
        committedInteractionIdRef.current = null;
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Impossible d'enregistrer l'interaction.",
      );
    } finally {
      inFlightRef.current = false;
    }
  };

  return (
    <div className="space-y-3" id="prospect_interactions_section">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Journal des interactions ({orderedInteractions.length})
          </h4>
        </div>
        <button
          type="button"
          onClick={() => setIsFormOpen((v) => !v)}
          className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-[11px] font-black flex items-center gap-1.5 cursor-pointer transition-all"
          id="toggle_add_interaction_btn"
        >
          <MessageSquarePlus className="w-3.5 h-3.5" />
          {isFormOpen ? 'Fermer' : 'Nouvelle interaction'}
        </button>
      </div>

      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#2a2a2e]/50 border border-slate-200/80 dark:border-slate-800 space-y-3"
          id="add_prospect_interaction_form"
        >
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label
                htmlFor="interaction_channel_select"
                className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1"
              >
                Canal *
              </label>
              <select
                id="interaction_channel_select"
                value={channel}
                onChange={(e) => setChannel(e.target.value as InteractionChannel)}
                className="w-full bg-white dark:bg-[#1f1f22] border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-900 dark:text-white"
              >
                {INTERACTION_CHANNELS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="interaction_action_select"
                className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1"
              >
                Type d'action *
              </label>
              <select
                id="interaction_action_select"
                value={actionType}
                onChange={(e) => setActionType(e.target.value as InteractionActionType)}
                className="w-full bg-white dark:bg-[#1f1f22] border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-900 dark:text-white"
              >
                {INTERACTION_ACTION_TYPES.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label
                htmlFor="interaction_outcome_select"
                className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1"
              >
                Résultat *
              </label>
              <select
                id="interaction_outcome_select"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value as InteractionOutcome)}
                className="w-full bg-white dark:bg-[#1f1f22] border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-900 dark:text-white"
              >
                {INTERACTION_OUTCOMES.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="interaction_date_input"
                className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1"
              >
                Date *
              </label>
              <input
                id="interaction_date_input"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-white dark:bg-[#1f1f22] border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="interaction_notes_input"
              className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1"
            >
              Notes
            </label>
            <textarea
              id="interaction_notes_input"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Résumé de l'échange, objections, intérêt produit..."
              className="w-full bg-white dark:bg-[#1f1f22] border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label
              htmlFor="interaction_next_followup_input"
              className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1"
            >
              Prochaine relance (optionnel)
            </label>
            <input
              id="interaction_next_followup_input"
              type="date"
              value={nextFollowUpDate}
              onChange={(e) => setNextFollowUpDate(e.target.value)}
              className="w-full bg-white dark:bg-[#1f1f22] border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-900 dark:text-white"
            />
            {nextFollowUpDate && (
              <label className="flex items-center gap-2 mt-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createAgendaFollowUp}
                  onChange={(e) => setCreateAgendaFollowUp(e.target.checked)}
                  className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                />
                <span>Créer aussi la relance dans l’Agenda pour le {nextFollowUpDate}</span>
              </label>
            )}
          </div>

          {errorMsg && (
            <p className="text-xs font-bold text-rose-600 dark:text-rose-400" role="alert">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs cursor-pointer transition-all"
            id="submit_prospect_interaction_btn"
          >
            {isSubmitting ? 'ENREGISTREMENT...' : "ENREGISTRER L'INTERACTION"}
          </button>
        </form>
      )}

      {orderedInteractions.length === 0 ? (
        <p className="text-xs text-slate-400 dark:text-slate-500 italic p-3 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
          Aucune interaction enregistrée pour le moment.
        </p>
      ) : (
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1" id="prospect_interactions_timeline">
          {orderedInteractions.map((item) => {
            const isResponse = isResponseOutcome(item.outcome);
            return (
              <div
                key={item.id}
                className="p-3 rounded-2xl bg-white dark:bg-[#1f1f22] border border-slate-200/80 dark:border-slate-800 space-y-1.5 text-xs"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-extrabold text-[10px]">
                      {getInteractionChannelLabel(item.channel)}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-bold text-[10px]">
                      {getInteractionActionLabel(item.actionType)}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md font-extrabold text-[10px] ${
                        item.outcome === 'CONVERTI'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : isResponse
                            ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {getInteractionOutcomeLabel(item.outcome)}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {item.date}
                  </span>
                </div>

                {item.notes && (
                  <p className="text-[11.5px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    {item.notes}
                  </p>
                )}

                {item.nextFollowUpDate && (
                  <div className="text-[10.5px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <CalendarPlus className="w-3 h-3" />
                    Relance prévue : {item.nextFollowUpDate}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
