import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { UserProfile, Product, GRADES, GradeCode } from '../../types';
import { 
  Sparkles, 
  User, 
  Wallet, 
  ShoppingBag, 
  Check, 
  X, 
  ArrowRight, 
  ArrowLeft, 
  Building, 
  Award,
  Phone,
  Plus,
  Trash2,
  CheckCircle2,
  HelpCircle,
  TrendingUp,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Recommended startup bundles / signature products in West/Central Africa for immediate activation
const CHOSEN_EASY_START_PRODUCTS = [
  { id: '15_new', name: 'FOREVER ALOE VERA GEL (Duo détox)', prixRetail: 40312, unitCC: 0.2 },
  { id: '51_new', name: 'ALOE PROPOLIS CRÈME (Soin boutons)', prixRetail: 15531, unitCC: 0.077 },
  { id: '28_new', name: 'FOREVER BRIGHT TOOTHGEL (Packs x3)', prixRetail: 26784, unitCC: 0.093 },
  { id: '547_new', name: 'PACK DÉTOX C9 MINCEUR (Vanille)', prixRetail: 97166, unitCC: 0.482 }
];

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  isManualTrigger?: boolean;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ isOpen, onClose, isManualTrigger = false }) => {
  const { profile, updateProfile, products, addProduct } = useStore();
  const [step, setStep] = useState(1);

  // Profile temporary form state
  const [fboName, setFboName] = useState(profile.name || '');
  const [fboTitle, setFboTitle] = useState(profile.title || '');
  const [companyName, setCompanyName] = useState(profile.companyName || '');
  const [fboId, setFboId] = useState(profile.fboId || '');
  const [fboGrade, setFboGrade] = useState<GradeCode>(profile.grade || 'AA');
  const [companyPhone, setCompanyPhone] = useState(profile.companyPhone || '');
  const [companyEmail, setCompanyEmail] = useState(profile.companyEmail || '');

  // Payments temporaries state
  const [waveMoney, setWaveMoney] = useState(profile.waveMoney || '');
  const [orangeMoney, setOrangeMoney] = useState(profile.orangeMoney || '');
  const [bankRIB, setBankRIB] = useState(profile.bankRIB || '');

  // Products temporary state (predefined favorites checklist & custom products creator)
  const [selectedQuickProducts, setSelectedQuickProducts] = useState<string[]>([
    '15_new', '51_new', '547_new'
  ]);
  const [customProducts, setCustomProducts] = useState<Omit<Product, 'id'>[]>([]);

  // New Custom Product Creator fields
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState<number | ''>('');
  const [newProdCC, setNewProdCC] = useState<number | ''>('');

  // Local validation error message
  const [validationError, setValidationError] = useState('');

  // Pre-populate fields on load
  useEffect(() => {
    if (isOpen) {
      setFboName(profile.name || '');
      setFboTitle(profile.title || '');
      setCompanyName(profile.companyName || '');
      setFboId(profile.fboId || '');
      setFboGrade(profile.grade || 'AA');
      setCompanyPhone(profile.companyPhone || '');
      setCompanyEmail(profile.companyEmail || '');
      setWaveMoney(profile.waveMoney || '');
      setOrangeMoney(profile.orangeMoney || '');
      setBankRIB(profile.bankRIB || '');
      setValidationError('');
      if (!isManualTrigger) {
        setStep(1); // Default to start
      }
    }
  }, [isOpen, profile]);

  if (!isOpen) return null;

  // Mask & clean FBO ID (Must contain digits only and be up to 12 chars)
  const handleFboIdChange = (val: string) => {
    const cleaned = val.replace(/[^0-9]/g, '').slice(0, 12);
    setFboId(cleaned);
  };

  // Toggle quick product activation selection
  const toggleQuickProduct = (id: string) => {
    setSelectedQuickProducts(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  // Add custom products to local list
  const handleAddLocalCustomProduct = () => {
    if (!newProdName.trim()) {
      setValidationError('Veuillez indiquer un nom pour le produit personnalisé.');
      return;
    }
    if (!newProdPrice || Number(newProdPrice) <= 0) {
      setValidationError('Indiquez un prix public de vente supérieur à 0 FCFA.');
      return;
    }
    const ccVal = newProdCC === '' ? 0.05 : Number(newProdCC);

    setCustomProducts(prev => [
      ...prev,
      {
        name: newProdName.trim().toUpperCase(),
        prixRetail: Number(newProdPrice),
        unitCC: ccVal
      }
    ]);

    // Reset inputs
    setNewProdName('');
    setNewProdPrice('');
    setNewProdCC('');
    setValidationError('');
  };

  const handleRemoveLocalCustomProduct = (index: number) => {
    setCustomProducts(prev => prev.filter((_, i) => i !== index));
  };

  // Handle Step progression & save partials
  const handleNextStep = () => {
    setValidationError('');

    if (step === 1) {
      if (!fboName.trim()) {
        setValidationError('Veuillez renseigner votre nom complet.');
        return;
      }
      if (fboId && fboId.length < 12) {
        setValidationError('Un identifiant officiel FBO chez Forever comporte normalement 12 chiffres.');
        return;
      }
    }

    if (step === 2) {
      // Wave and orange validation (at least warning if both empty)
      if (!waveMoney && !orangeMoney) {
        // We let them pass, but warn them
      }
    }

    setStep(prev => prev + 1);
  };

  const handlePrevStep = () => {
    setValidationError('');
    setStep(prev => prev - 1);
  };

  // Compute initials helper
  const computeInitials = (nameStr: string) => {
    if (!nameStr) return 'FBO';
    const split = nameStr.trim().split(/\s+/);
    if (split.length >= 2) {
      return (split[0].charAt(0) + split[1].charAt(0)).toUpperCase();
    }
    return nameStr.substring(0, 2).toUpperCase();
  };

  // Finish onboarding and save to Global App Store
  const handleCompleteOnboarding = () => {
    // 1. Generate updated user profile
    const updatedProfile: UserProfile = {
      ...profile,
      name: fboName,
      initials: computeInitials(fboName),
      title: fboTitle ? fboTitle : (GRADES.find(g => g.code === fboGrade)?.label || 'Distributeur Forever'),
      grade: fboGrade,
      companyName: companyName ? companyName : `${fboName} Solutions`,
      fboId: fboId ? fboId : 'Non défini',
      companyPhone: companyPhone || profile.companyPhone,
      companyEmail: companyEmail || profile.companyEmail,
      waveMoney: waveMoney || undefined,
      orangeMoney: orangeMoney || undefined,
      bankRIB: bankRIB || undefined,
    };

    // Save profile to useStore state
    updateProfile(updatedProfile);

    // Injection de produits désactivée pour éviter la confusion dans le catalogue global

    // 4. Save completed flag
    try {
      localStorage.setItem('fcf-onboarding-completed', 'true');
    } catch (e) {
      console.error(e);
    }

    // Call final callback to close
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-60 flex items-center justify-center p-4 overflow-y-auto" id="onboarding_wizard_backdrop">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white dark:bg-[#1a1a1d] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col relative text-left"
        id="onboarding_wizard_modal"
      >
        {/* Header Indicator */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-[#151518]/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-extrabold text-lg select-none shadow-md shadow-amber-500/10">
              ⚡
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                {isManualTrigger ? 'Guide de Configuration Assistée' : 'Onboarding FBO Express'}
              </h2>
              <p className="text-[10px] text-amber-600 dark:text-amber-500 font-extrabold tracking-wide uppercase flex items-center gap-1 mt-0.5">
                <Sparkles className="w-3.5 h-3.5 fill-amber-500/20" />
                Démarrage rapide & configuration de votre activité
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-3 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer min-w-[48px] min-h-[48px] flex items-center justify-center"
            title="Sauter"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Timeline Tracker */}
        <div className="px-6 py-4 bg-slate-100/50 dark:bg-[#131316]/50 border-b border-slate-150 dark:border-slate-800/60 flex items-center justify-between gap-1 select-none">
          {[1, 2, 3, 4].map((num) => {
            const active = step >= num;
            const current = step === num;
            return (
              <div key={num} className="flex-1 flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center transition-all ${
                    current 
                      ? 'bg-amber-500 text-slate-950 ring-4 ring-amber-500/20' 
                      : active 
                        ? 'bg-amber-600 text-slate-950' 
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-450 dark:text-slate-600'
                  }`}>
                    {active && step > num ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : num}
                  </span>
                  <span className={`hidden sm:inline text-[10px] font-bold uppercase tracking-wider ${
                    current ? 'text-slate-900 dark:text-slate-100 font-black' : active ? 'text-amber-600 dark:text-amber-500' : 'text-slate-400'
                  }`}>
                    {num === 1 ? 'Identité' : num === 2 ? 'Finances' : num === 3 ? 'Catalogue' : 'Finalisation'}
                  </span>
                </div>
                {num < 4 && (
                  <div className={`flex-1 h-0.5 mx-2 rounded ${active && step > num ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-800'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Wizard Main Panel Body Container */}
        <div className="p-6 flex-1 overflow-y-auto max-h-[60vh] space-y-5" id="onboarding_wizard_step_body">
          {validationError && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold leading-relaxed flex items-center gap-2 animate-shake">
              <span className="text-sm">⚠️</span>
              {validationError}
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* STEP 1: IDENTIFICATION PROFILE */}
            {step === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-800 dark:text-slate-100 tracking-wide flex items-center gap-1.5">
                    <User className="w-4 h-4 text-amber-500" />
                    Étape 1 : Votre Profil Personnel de FBO
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Indiquez vos informations d'entrepreneur indépendant pour que l'application calcule instantanément vos marges et votre prix d'achat grossiste sur chaque vente.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* FBO Real Name */}
                  <div className="space-y-1.5">
                    <label className="text-[10.5px] font-black uppercase tracking-wider text-slate-650 dark:text-slate-300">
                      Votre nom et prénom <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={fboName}
                        onChange={(e) => setFboName(e.target.value)}
                        placeholder="Saisissez votre nom complet"
                        className="w-full bg-slate-50 dark:bg-[#121215] border border-slate-200 dark:border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white outline-none font-bold placeholder:font-normal"
                        id="onb_fbo_name_input"
                      />
                    </div>
                  </div>

                  {/* FBO Official ID */}
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10.5px] font-black uppercase tracking-wider text-slate-650 dark:text-slate-300 flex items-center gap-1">
                      Identifiant ID Forever FBO (12 chiffres)
                      <span className="lowercase text-[9px] text-slate-400 font-medium">(conseillé)</span>
                    </label>
                    <input
                      type="text"
                      value={fboId}
                      onChange={(e) => handleFboIdChange(e.target.value)}
                      placeholder="Saisissez votre ID (12 chiffres)"
                      className="w-full bg-slate-50 dark:bg-[#121215] border border-slate-200 dark:border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white outline-none font-mono font-bold"
                      id="onb_fbo_id_input"
                    />
                  </div>
                </div>

                {/* Profile Grade Choice Segment */}
                <div className="space-y-2">
                  <label className="text-[10.5px] font-black uppercase tracking-wider text-slate-650 dark:text-slate-300 flex items-center gap-1 select-none">
                    <Award className="w-4 h-4 text-amber-500" />
                    Votre Grade Actuel (Niveau de remise)
                  </label>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    Votre marge commerciale de revente directe correspond à la différence entre le prix public conseillé et votre tarif grossiste basé sur votre niveau :
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1.5">
                    {GRADES.map((g) => {
                      const selected = fboGrade === g.code;
                      return (
                        <button
                          type="button"
                          key={g.code}
                          onClick={() => setFboGrade(g.code)}
                          className={`p-3 rounded-xl border flex items-center justify-between text-left transition-all cursor-pointer ${
                            selected
                              ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/20'
                              : 'bg-slate-50 hover:bg-slate-100/50 dark:bg-[#121215] dark:hover:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                          }`}
                          id={`onb_grade_select_${g.code}`}
                        >
                          <div>
                            <p className="text-[11px] font-bold text-slate-950 dark:text-slate-50 leading-tight">
                              {g.label}
                            </p>
                            <p className="text-[9.5px] text-slate-450 dark:text-slate-550 mt-0.5 leading-none">
                              Réf: {g.code === 'AA' ? 'A. Animateur' : g.code === 'A' ? 'Animateur' : g.code === 'MA' ? 'M. Adjoint' : 'Manager'}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-1.5 md:gap-2.5 shrink-0 text-right">
                            <span className="text-[11px] font-black text-amber-600 dark:text-amber-500 leading-none">
                              Remise: {g.tauxRemise * 100}%
                            </span>
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                              selected ? 'bg-amber-500 border-amber-500 text-slate-950' : 'border-slate-350 dark:border-slate-700'
                            }`}>
                              {selected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Secondary Professional info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-850 pt-4">
                  <div className="space-y-1.5">
                    <label className="text-[10.5px] font-black uppercase tracking-wider text-slate-650 dark:text-slate-300 flex items-center gap-1">
                      <Building className="w-3.5 h-3.5" />
                      Nom facultatif de votre agence / boutique
                    </label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Saisissez le nom de votre entreprise"
                      className="w-full bg-slate-50 dark:bg-[#121215] border border-slate-200 dark:border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white outline-none font-bold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10.5px] font-black uppercase tracking-wider text-slate-650 dark:text-slate-300">
                      Téléphone de contact commercial
                    </label>
                    <input
                      type="text"
                      value={companyPhone}
                      onChange={(e) => setCompanyPhone(e.target.value)}
                      placeholder="Saisissez votre numéro de téléphone"
                      className="w-full bg-slate-50 dark:bg-[#121215] border border-slate-200 dark:border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white outline-none font-bold"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 2: FINANCES & MOBILE MONEY PAYMENT */}
            {step === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-800 dark:text-slate-100 tracking-wide flex items-center gap-1.5">
                    <Wallet className="w-4 h-4 text-amber-500" />
                    Étape 2 : Coordonnées de Paiement & Facturation
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Ajoutez vos numéros de portefeuille Mobile Money. Vos clients pourront scanner ou régler directement sur ces numéros lors de l'enregistrement de leurs commandes.
                  </p>
                </div>

                <div className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* PAIEMENT MOBILE 1 */}
                    <div className="p-4 rounded-2xl bg-sky-500/5 dark:bg-sky-505/5 border border-sky-200 dark:border-sky-900/30 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-sky-500 text-slate-950 flex items-center justify-center font-black text-xs select-none shadow">
                          1
                        </span>
                        <div>
                          <p className="text-xs font-bold text-sky-950 dark:text-sky-400">Paiement Mobile 1</p>
                          <p className="text-[9.5px] text-slate-450 dark:text-slate-500">Pour encaissement rapide</p>
                        </div>
                      </div>
                      
                      <input
                        type="text"
                        value={waveMoney}
                        onChange={(e) => setWaveMoney(e.target.value)}
                        placeholder="Saisissez un numéro de téléphone"
                        className="w-full bg-white dark:bg-[#121215] border border-slate-205 dark:border-slate-850 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none font-bold"
                        id="onb_wave_input"
                      />
                    </div>

                    {/* PAIEMENT MOBILE 2 */}
                    <div className="p-4 rounded-2xl bg-orange-550/5 dark:bg-orange-550/5 border border-orange-200 dark:border-orange-900/30 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-orange-500 text-slate-950 flex items-center justify-center font-black text-xs select-none shadow">
                          2
                        </span>
                        <div>
                          <p className="text-xs font-bold text-orange-950 dark:text-orange-450">Paiement Mobile 2</p>
                          <p className="text-[9.5px] text-slate-450 dark:text-slate-500">Pour encaissement mobile</p>
                        </div>
                      </div>
                      
                      <input
                        type="text"
                        value={orangeMoney}
                        onChange={(e) => setOrangeMoney(e.target.value)}
                        placeholder="Saisissez un numéro de téléphone"
                        className="w-full bg-white dark:bg-[#121215] border border-slate-205 dark:border-slate-850 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none font-bold"
                        id="onb_orange_input"
                      />
                    </div>
                  </div>

                  {/* BANK RIB */}
                  <div className="space-y-1.5 p-3.5 bg-slate-50 dark:bg-[#141417]/40 border border-slate-200 dark:border-slate-850/80 rounded-2xl">
                    <label className="text-[10.5px] font-black uppercase text-slate-700 dark:text-slate-350 flex items-center gap-1.5">
                      RIB Bancaire complet (virements bonus FLP de fin de mois)
                    </label>
                    <p className="text-[9px] text-slate-450 dark:text-slate-500 mb-1 leading-normal">
                      Ce RIB sera affiché de manière sécurisée en bas de vos factures clients pour faciliter les paiements par virement.
                    </p>
                    <input
                      type="text"
                      value={bankRIB}
                      onChange={(e) => setBankRIB(e.target.value)}
                      placeholder="Saisissez votre RIB ou IBAN"
                      className="w-full bg-white dark:bg-[#121215] border border-slate-200 dark:border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="p-3 bg-amber-500/10 border border-amber-500/15 rounded-xl flex items-start gap-2 text-[10px] text-amber-705 dark:text-amber-400 select-none">
                  <Info className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                  <p className="leading-relaxed">
                    <strong>Sécurité locale :</strong> Toutes vos données financières sont stockées exclusivement sur votre navigateur ou vos serveurs de synchronisation privativement. L'équipe technique de développement n'a aucun accès ou visibilité.
                  </p>
                </div>
              </motion.div>
            )}

            {/* STEP 3: HIGH ROTATION COMMODITIES OR CUSTOM SERVICES */}
            {step === 3 && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-800 dark:text-slate-100 tracking-wide flex items-center gap-1.5">
                    <ShoppingBag className="w-4 h-4 text-amber-500" />
                    Étape 3 : Vos Premiers Produits ou Packs Favoris
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Cochez les produits Forever que vous souhaitez vendre en priorité aujourd'hui ou fabriquez immédiatement vos propres bundles/services FBO.
                  </p>
                </div>

                {/* Preconfigured items checkbox menu */}
                <div className="space-y-2">
                  <label className="text-[10.5px] font-black uppercase tracking-wider text-slate-650 dark:text-slate-350 block">
                    Sélectionner les produits Forever favoris pour votre catalogue rapide :
                  </label>
                  
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl bg-[#fcfcfd]/40 dark:bg-[#131316]/20 overflow-hidden">
                    {CHOSEN_EASY_START_PRODUCTS.map((prod) => {
                      const selected = selectedQuickProducts.includes(prod.id);
                      return (
                        <button
                          type="button"
                          key={prod.id}
                          onClick={() => toggleQuickProduct(prod.id)}
                          className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-left transition-colors cursor-pointer select-none"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                              selected ? 'bg-amber-500 border-amber-500 text-slate-950' : 'border-slate-300 dark:border-slate-700'
                            }`}>
                              {selected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                            
                            <div>
                              <p className="text-xs font-bold text-slate-900 dark:text-slate-50">
                                {prod.name}
                              </p>
                              <p className="text-[9.5px] text-slate-450 dark:text-slate-550 font-bold">
                                {prod.prixRetail.toLocaleString('fr-FR')} FCFA • <span className="text-amber-500 font-extrabold">{prod.unitCC} CC</span>
                              </p>
                            </div>
                          </div>
                          <span className="text-[9px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-extrabold uppercase">
                            Premium
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Add Custom personalized items builder */}
                <div className="border-t border-slate-100 dark:border-slate-850 pt-4 space-y-3">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      Ajouter un pack personnalisé ou soin sur-mesure ?
                    </h4>
                    <p className="text-[10px] text-slate-500">
                      Vous pouvez créer des kits d'assemblages ou des prestations de coaching minceur et détox que vous commercialisez sous votre propre marque :
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 bg-slate-50 dark:bg-[#121215] p-3 rounded-2xl border border-slate-150 dark:border-slate-850">
                    <div className="sm:col-span-2 space-y-1">
                      <span className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-550 block select-none">Nom du soin/pack</span>
                      <input
                        type="text"
                        value={newProdName}
                        onChange={(e) => setNewProdName(e.target.value)}
                        placeholder="Saisissez le nom du produit"
                        className="w-full bg-white dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-550 block select-none">Prix (FCFA)</span>
                      <input
                        type="number"
                        value={newProdPrice}
                        onChange={(e) => setNewProdPrice(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="Saisissez le prix"
                        className="w-full bg-white dark:bg-[#18181b] border border-slate-205 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-550 block select-none">Cases CC (FLP)</span>
                      <input
                        type="number"
                        step="0.01"
                        value={newProdCC}
                        onChange={(e) => setNewProdCC(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="Saisissez les CC"
                        className="w-full bg-white dark:bg-[#18181b] border border-slate-205 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold outline-none"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={handleAddLocalCustomProduct}
                        className="w-full py-1.5 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white hover:text-amber-400 rounded-lg text-xs font-black uppercase flex items-center justify-center gap-1 cursor-pointer h-9 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Créer
                      </button>
                    </div>
                  </div>

                  {/* List of custom additions */}
                  {customProducts.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <p className="text-[9px] font-black text-amber-600 dark:text-amber-500 uppercase select-none">
                        Packs personnalisés à injecter dans votre boutique ({customProducts.length}) :
                      </p>
                      
                      <div className="max-h-24 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/40 border border-[#eff0f2] dark:border-slate-800 rounded-xl bg-white dark:bg-[#111113] p-1">
                        {customProducts.map((cp, idx) => (
                          <div key={idx} className="p-2 flex items-center justify-between text-xs text-slate-800 dark:text-slate-300 font-bold">
                            <div>
                              <span>{cp.name}</span>
                              <span className="text-[9px] text-slate-450 dark:text-slate-500 font-bold ml-2">
                                ({cp.prixRetail.toLocaleString()} FCFA • {cp.unitCC} CC)
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveLocalCustomProduct(idx)}
                              className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                              title="Retirer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              </motion.div>
            )}

            {/* STEP 4: QUICK START GUIDE & CONFIRMATION */}
            {step === 4 && (
              <motion.div
                key="step-4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                <div className="text-center py-4 flex flex-col items-center justify-center gap-2 select-none">
                  <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center animate-bounce text-3xl">
                    🚀
                  </div>
                  <h3 className="text-base font-black uppercase text-slate-900 dark:text-slate-50 tracking-wide mt-1">
                    Prêt pour le Décollage de votre Business FLP !
                  </h3>
                  <p className="text-xs text-slate-500 max-w-lg">
                    Fantastique ! Vos données FBO de base sont configurées. Rappelez-vous ces 3 commandements essentiels pour faire prospérer votre activité de vente directe :
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-center px-2 select-none">
                  <div className="p-3.5 bg-slate-50 dark:bg-[#121215] border border-slate-150 dark:border-slate-800 rounded-2xl flex flex-col items-center gap-1.5">
                    <span className="text-emerald-500 text-lg">📈</span>
                    <h4 className="text-[11px] font-black uppercase text-slate-900 dark:text-slate-100">Pipelines & Suivi</h4>
                    <p className="text-[10px] text-slate-450 dark:text-slate-500 leading-normal">
                      Classifiez vos contacts africains (Prospects, Clients, Présentations faites) pour ne perdre aucune opportunité commerciale.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 dark:bg-[#121215] border border-slate-150 dark:border-slate-800 rounded-2xl flex flex-col items-center gap-1.5">
                    <span className="text-amber-505 text-lg">💰</span>
                    <h4 className="text-[11px] font-black uppercase text-slate-900 dark:text-slate-100">Calculateur Marge</h4>
                    <p className="text-[10px] text-slate-450 dark:text-slate-500 leading-normal">
                      Vendez au prix Retail préconisé. L'application déduira automatiquement votre taux d'achat grossiste selon votre niveau.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 dark:bg-[#121215] border border-slate-150 dark:border-slate-800 rounded-2xl flex flex-col items-center gap-1.5">
                    <span className="text-sky-502 text-lg">📲</span>
                    <h4 className="text-[11px] font-black uppercase text-slate-900 dark:text-slate-100">Relances & Agenda</h4>
                    <p className="text-[10px] text-slate-450 dark:text-slate-500 leading-normal">
                      Notre nouveau Centre de Rappels vous alertera chaque matin de vos livraisons et suivis du jour à recontacter sur WhatsApp.
                    </p>
                  </div>
                </div>

                {/* Configuration Summary Card */}
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-amber-705 dark:text-amber-450 flex items-center gap-1.5 select-none text-left">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Récapitulatif de votre Configuration active :
                  </h4>
                  
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <div className="text-left font-normal text-slate-450">Nom du FBO :</div>
                    <div className="text-right">{fboName}</div>

                    <div className="text-left font-normal text-slate-450">Remise grossiste calculée :</div>
                    <div className="text-right text-amber-600 dark:text-amber-500 font-black">
                      {fboGrade === 'AA' ? 'Assistant Animateur (-30%)' : fboGrade === 'A' ? 'Animateur (-38%)' : fboGrade === 'MA' ? 'Manager Adjoint (-43%)' : 'Manager (-48%)'}
                    </div>

                    <div className="text-left font-normal text-slate-450">Numéros mobiles connectés :</div>
                    <div className="text-right truncate text-[11px]">
                      {waveMoney ? `Mobile 1` : ''} {orangeMoney ? `• Mobile 2` : ''} {!waveMoney && !orangeMoney ? 'Aucun' : ''}
                    </div>

                    <div className="text-left font-normal text-slate-450">Produits favoris activés :</div>
                    <div className="text-right">
                      {selectedQuickProducts.length + customProducts.length} produit(s)
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer controls */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-[#151518]/30 flex items-center justify-between">
          {/* Back button */}
          {step > 1 ? (
            <button
              onClick={handlePrevStep}
              className="py-2.1 px-4 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-xl text-xs font-black uppercase text-slate-600 dark:text-slate-450 flex items-center gap-1 cursor-pointer h-12 transition-colors"
              id="onboarding_prev_btn"
            >
              <ArrowLeft className="w-4 h-4" />
              Précédent
            </button>
          ) : (
            <div />
          )}

          {/* Next / Terminer button */}
          {step < 4 ? (
            <button
              onClick={handleNextStep}
              className="py-2.1 px-5 bg-slate-900 hover:bg-slate-800 dark:bg-amber-500 dark:hover:bg-amber-600 text-white dark:text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer h-12 transition-all active:scale-95 shadow-lg shadow-amber-500/5 hover:-translate-y-0.5"
              id="onboarding_next_btn"
            >
              Suivant
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleCompleteOnboarding}
              className="py-2.1 px-6 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer h-12 transition-all active:scale-95 shadow-lg shadow-emerald-500/10 hover:-translate-y-0.5"
              id="onboarding_finish_btn"
            >
              Terminer & Lancer ! 🚀
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
