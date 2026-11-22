import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ConversionChannel, Customer } from '../../../types';
import { Drawer } from '../Drawer';
import {
  CONVERSION_CHANNELS,
  getInteractionChannelLabel,
} from '../../../lib/prospectInteractions';
import { localDateISO } from '../../../lib/orderStats';
import { AlertCircle, CheckCircle2, ChevronsRight } from 'lucide-react';

interface ProspectConversionModalProps {
  prospect: Customer | null;
  isOpen: boolean;
  isPending: boolean;
  onClose: () => void;
  onConfirm: (params: {
    prospect: Customer;
    conversionChannel: ConversionChannel;
    convertedAt: string;
    logConversionInteraction: boolean;
  }) => Promise<void>;
}

export const ProspectConversionModal: React.FC<ProspectConversionModalProps> = ({
  prospect,
  isOpen,
  isPending,
  onClose,
  onConfirm,
}) => {
  const [selectedChannel, setSelectedChannel] = useState<ConversionChannel | ''>('');
  const [logClosingInteraction, setLogClosingInteraction] = useState(false);
  const [validationError, setValidationError] = useState('');
  const inFlightRef = useRef(false);

  const todayDate = localDateISO();

  useEffect(() => {
    if (isOpen) {
      // Ne jamais pré-sélectionner ni auto-déduire le canal de conversion.
      setSelectedChannel('');
      setLogClosingInteraction(false);
      setValidationError('');
      inFlightRef.current = false;
    }
  }, [isOpen, prospect?.id]);

  const recordedChannels = useMemo(() => {
    if (!prospect?.interactions?.length) return [];
    return Array.from(new Set(prospect.interactions.map((i) => i.channel)));
  }, [prospect?.interactions]);

  const hasInteractionOnSelectedChannel = useMemo(() => {
    if (!selectedChannel || selectedChannel === 'INCONNU') return false;
    return recordedChannels.includes(selectedChannel);
  }, [recordedChannels, selectedChannel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prospect || isPending || inFlightRef.current) return;
    if (!selectedChannel) {
      setValidationError(
        'Veuillez sélectionner explicitement un canal d’attribution (ou « Inconnu / Non attribuable »).',
      );
      return;
    }
    setValidationError('');
    inFlightRef.current = true;
    try {
      await onConfirm({
        prospect,
        conversionChannel: selectedChannel,
        convertedAt: todayDate,
        logConversionInteraction:
          selectedChannel !== 'INCONNU' && logClosingInteraction,
      });
    } finally {
      inFlightRef.current = false;
    }
  };

  return (
    <Drawer
      isOpen={isOpen && prospect !== null}
      onClose={onClose}
      title={prospect ? `Convertir · ${prospect.name}` : 'Convertir le prospect'}
    >
      {prospect && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4"
          id="prospect_conversion_modal_form"
        >
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#2a2a2e]/50 border border-slate-200/70 dark:border-slate-800 space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 dark:text-slate-400 font-bold">
                Date réelle de conversion :
              </span>
              <strong className="text-slate-900 dark:text-slate-100 font-extrabold">
                {todayDate}
              </strong>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {recordedChannels.length > 0 ? (
                <>
                  Canaux déjà utilisés dans le journal :{' '}
                  <strong className="text-slate-700 dark:text-slate-200">
                    {recordedChannels.map((c) => getInteractionChannelLabel(c)).join(', ')}
                  </strong>
                </>
              ) : (
                'Aucune interaction enregistrée dans le journal pour ce prospect.'
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-extrabold text-slate-700 dark:text-slate-200 mb-2">
              Canal ayant déclenché la conversion *
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
              Sélectionnez le canal réel à créditer (ou « Inconnu / Non attribuable » si
              vous ne pouvez pas le déterminer). Aucun canal n’est déduit automatiquement.
            </p>

            <div
              className="grid grid-cols-2 gap-2"
              role="radiogroup"
              aria-label="Canal d'attribution de la conversion"
            >
              {CONVERSION_CHANNELS.map(({ code, label }) => {
                const isSelected = selectedChannel === code;
                const usedInLog = code !== 'INCONNU' && recordedChannels.includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => {
                      setSelectedChannel(code);
                      setValidationError('');
                      if (code === 'INCONNU') {
                        setLogClosingInteraction(false);
                      }
                    }}
                    className={`p-3 rounded-xl border text-left transition-all text-xs font-bold flex flex-col gap-0.5 cursor-pointer ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/30'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1f1f22] text-slate-700 dark:text-slate-300 hover:border-amber-400'
                    }`}
                    id={`conversion_channel_option_${code}`}
                  >
                    <span>{label}</span>
                    {usedInLog && (
                      <small className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                        Présent dans le journal
                      </small>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedChannel &&
            selectedChannel !== 'INCONNU' &&
            !hasInteractionOnSelectedChannel && (
              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-800/40 space-y-2 text-[11px] text-amber-800 dark:text-amber-200">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <span>
                    Aucune interaction sur{' '}
                    <strong>{getInteractionChannelLabel(selectedChannel)}</strong> n’est
                    encore enregistrée pour ce prospect. Selon les règles statistiques, il ne
                    comptera dans le taux de conversion de ce canal que s’il possède au moins
                    une interaction sur ce même canal.
                  </span>
                </div>
                <label className="flex items-center gap-2 font-bold cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={logClosingInteraction}
                    onChange={(e) => setLogClosingInteraction(e.target.checked)}
                    className="rounded border-amber-400 text-emerald-600 focus:ring-emerald-500"
                    id="conversion_log_interaction_checkbox"
                  />
                  <span>
                    Enregistrer aussi l’interaction « Converti » sur{' '}
                    {getInteractionChannelLabel(selectedChannel)} aujourd’hui
                  </span>
                </label>
              </div>
            )}

          {selectedChannel &&
            selectedChannel !== 'INCONNU' &&
            hasInteractionOnSelectedChannel && (
              <label className="flex items-center gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-[#2a2a2e]/40 border border-slate-200/70 dark:border-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={logClosingInteraction}
                  onChange={(e) => setLogClosingInteraction(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  id="conversion_log_interaction_checkbox"
                />
                <span>
                  Ajouter également une interaction finale « Converti » sur{' '}
                  {getInteractionChannelLabel(selectedChannel)}
                </span>
              </label>
            )}

          {validationError && (
            <p className="text-xs font-bold text-rose-600 dark:text-rose-400" role="alert">
              {validationError}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isPending || !selectedChannel}
              className="flex-1 py-3.5 px-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold rounded-2xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
              id="confirm_prospect_conversion_btn"
            >
              {isPending ? (
                'CONVERSION...'
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  CONFIRMER LA CONVERSION
                  <ChevronsRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </Drawer>
  );
};
