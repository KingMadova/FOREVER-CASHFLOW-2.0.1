import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Card } from '../components/ui/Card';
import { GRADES, GradeCode } from '../types';
import { 
  User, 
  CreditCard, 
  Percent, 
  Save, 
  Building2,
  Upload,
  Camera,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { auth } from '../lib/firebase';

const resizeAndCompressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 300;
        const MAX_HEIGHT = 300;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Compress as jpeg with 0.8 quality
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
      img.src = event.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

export const ProfileView: React.FC = () => {
  const { 
    profile, 
    updateProfile
  } = useStore();

  const [profileSaved, setProfileSaved] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(profile.photoUrl || '');

  useEffect(() => {
    setPhotoUrl(profile.photoUrl || '');
  }, [profile.photoUrl]);

  // Profile Form states
  const [name, setName] = useState(profile.name);
  const [title, setTitle] = useState(profile.title || '');
  const [fboId, setFboId] = useState(profile.fboId || '');
  const [grade, setGrade] = useState<GradeCode>(profile.grade);
  const [companyName, setCompanyName] = useState(profile.companyName || '');
  const [companyAddress, setCompanyAddress] = useState(profile.companyAddress || '');
  const [companyPhone, setCompanyPhone] = useState(profile.companyPhone || '');
  const [companyEmail, setCompanyEmail] = useState(profile.companyEmail || '');
  
  // Payment methods for client invoices
  const [waveMoney, setWaveMoney] = useState(profile.waveMoney || '');
  const [orangeMoney, setOrangeMoney] = useState(profile.orangeMoney || '');
  const [bankRIB, setBankRIB] = useState(profile.bankRIB || '');

  // Tax Settings
  const [tvaApplicable, setTvaApplicable] = useState(profile.tvaApplicable || false);
  const [tvaRate, setTvaRate] = useState<number>(profile.tvaRate || 18); // default WAEMU Senegal TVA rate is 18%

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64Data = await resizeAndCompressImage(file);
      setPhotoUrl(base64Data);
      updateProfile({
        ...profile,
        photoUrl: base64Data
      });
    } catch (err) {
      console.error("Error uploading photo:", err);
    }
  };

  const handleSyncGooglePhoto = () => {
    const googlePhoto = auth.currentUser?.photoURL;
    if (googlePhoto) {
      setPhotoUrl(googlePhoto);
      updateProfile({
        ...profile,
        photoUrl: googlePhoto
      });
    }
  };

  const handleRemovePhoto = () => {
    setPhotoUrl('');
    updateProfile({
      ...profile,
      photoUrl: ''
    });
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

    updateProfile({
      ...profile,
      name,
      title,
      initials,
      photoUrl,
      fboId,
      grade,
      companyName,
      companyAddress,
      companyPhone,
      companyEmail,
      waveMoney,
      orangeMoney,
      bankRIB,
      tvaApplicable,
      tvaRate
    });

    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2500);
  };

  const currentGrade = GRADES.find(g => g.code === grade) || GRADES[1];

  return (
    <div className="space-y-6 text-left" id="profile_view_container">
      
      {/* Dynamic Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-205/60 dark:border-slate-800 pb-4">
        <div>
          <span className="text-[10px] uppercase font-bold text-amber-500 tracking-wider">Identité Professionnelle</span>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">Mon Profil d'Activité FBO</h2>
          <p className="text-xs text-slate-500">Configurez votre identité FLP de distributeur indépendant, vos marges de grade et coordonnées de facturation client.</p>
        </div>

        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('open-onboarding-wizard'))}
          className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 hover:text-slate-900 text-xs font-black uppercase rounded-xl transition-all shadow-lg shadow-amber-500/10 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer select-none shrink-0"
          id="profile_retrigger_onboarding_btn"
        >
          <span>⚡ Assistant de Démarrage</span>
        </button>
      </div>

      <div className="space-y-6" id="settings_tab_profile_content">

        <form onSubmit={handleSaveProfile} className="space-y-6">
          
          {/* Primary core profile card */}
          <Card className="p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1f1f22]">
            <div className="flex items-center gap-2 mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <User className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Identité FBO (Forever Business Owner)
              </h3>
            </div>

            {/* Profile Photo Block */}
            <div className="flex flex-col sm:flex-row items-center gap-6 mb-6 p-4 bg-slate-50 dark:bg-[#1a1a1d] rounded-3xl border border-slate-100 dark:border-slate-800">
              <div className="relative group shrink-0">
                <div className="w-24 h-24 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 font-black text-2xl flex items-center justify-center border-2 border-amber-200/50 dark:border-amber-900/50 overflow-hidden shadow-inner">
                  {photoUrl ? (
                    <img 
                      src={photoUrl} 
                      alt="Profil" 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    profile.initials || 'FBO'
                  )}
                </div>
                <label className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-amber-500 hover:bg-amber-600 text-slate-950 flex items-center justify-center cursor-pointer shadow-md transition-colors border-2 border-white dark:border-[#1f1f22]">
                  <Camera className="w-4 h-4" />
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handlePhotoUpload} 
                    className="hidden" 
                  />
                </label>
              </div>

              <div className="flex-1 space-y-2 text-center sm:text-left">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Photo de Profil</h4>
                <p className="text-xs text-slate-500 max-w-sm">
                  Personnalisez votre photo de profil pour vos rapports, documents de vente et l'interface de l’application.
                </p>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                  <label className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-[#34343a] text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm">
                    <Upload className="w-3.5 h-3.5 text-amber-500" />
                    <span>Téléverser manuellement</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handlePhotoUpload} 
                      className="hidden" 
                    />
                  </label>

                  {auth.currentUser?.photoURL && (
                    <button
                      type="button"
                      onClick={handleSyncGooglePhoto}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-amber-500 dark:hover:bg-amber-600 dark:text-slate-950 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Synchroniser avec Google</span>
                    </button>
                  )}

                  {photoUrl && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-450 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Supprimer</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Nom complet *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">ID FBO FLP (12 chiffres)</label>
                <input
                  type="text"
                  value={fboId}
                  onChange={(e) => setFboId(e.target.value)}
                  placeholder="Saisissez votre ID"
                  className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Grade Professionnel FLP</label>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value as GradeCode)}
                  className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white font-bold"
                >
                  {GRADES.map(g => (
                    <option key={g.code} value={g.code}>
                      {g.label} - Remise d'achat {Math.round(g.tauxRemise * 100)}%
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center md:col-span-2">
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 p-3.5 rounded-2xl w-full text-xs shrink-0 self-end h-12 flex items-center justify-between">
                  <span className="text-slate-500 font-bold">Marge brute assurée:</span>
                  <span className="text-amber-600 dark:text-amber-400 font-black text-sm">
                    {Math.round(currentGrade.tauxRemise * 100)} %
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Business invoicing coordinates */}
          <Card className="p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1f1f22]">
            <div className="flex items-center gap-2 mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Building2 className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                En-tête de Facture & Entreprise
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Nom d'enseigne / Entreprise</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Saisissez le nom de l'entreprise"
                  className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Téléphone de livraison</label>
                <input
                  type="text"
                  value={companyPhone}
                  onChange={(e) => setCompanyPhone(e.target.value)}
                  placeholder="Saisissez un numéro de téléphone"
                  className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-250 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-500 block mb-1">E-mail de contact clients</label>
                <input
                  type="email"
                  value={companyEmail}
                  onChange={(e) => setCompanyEmail(e.target.value)}
                  placeholder="Saisissez votre adresse email"
                  className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-250 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-500 block mb-1">Adresse postale / Ville d'exercice</label>
                <input
                  type="text"
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  placeholder="Saisissez l'adresse de l'entreprise"
                  className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-250 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white"
                />
              </div>
            </div>
          </Card>

          {/* Money payment coordinates */}
          <Card className="p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1f1f22]">
            <div className="flex items-center gap-2 mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <CreditCard className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Coordonnées de Recevabilité (Paiement)
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Paiement Mobile 1</label>
                <input
                  type="text"
                  value={waveMoney}
                  onChange={(e) => setWaveMoney(e.target.value)}
                  placeholder="Saisissez un numéro de téléphone"
                  className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Paiement Mobile 2</label>
                <input
                  type="text"
                  value={orangeMoney}
                  onChange={(e) => setOrangeMoney(e.target.value)}
                  placeholder="Saisissez un numéro de téléphone"
                  className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-500 block mb-1">RIB Bancaire (pour virements officiels)</label>
                <input
                  type="text"
                  value={bankRIB}
                  onChange={(e) => setBankRIB(e.target.value)}
                  placeholder="Saisissez votre RIB ou IBAN"
                  className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white"
                />
              </div>
            </div>
          </Card>

          {/* Fiscal/TVA options */}
          <Card className="p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1f1f22]">
            <div className="flex items-center gap-2 mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Percent className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Paramètres Fiscaux / Taxe & TVA
              </h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100">Facturer la TVA locale</p>
                  <p className="text-[10px] text-slate-400">Si désactivé, l'exonération de taxe d'auto-entrepreneur s’affiche sur les bons de vente.</p>
                </div>
                <input
                  type="checkbox"
                  checked={tvaApplicable}
                  onChange={(e) => setTvaApplicable(e.target.checked)}
                  className="w-5 h-5 rounded accent-amber-500 cursor-pointer"
                />
              </div>

              {tvaApplicable && (
                <div className="w-32">
                  <label className="text-xs font-bold text-slate-500 block mb-1">Taux de TVA (%)</label>
                  <input
                    type="number"
                    value={tvaRate}
                    onChange={(e) => setTvaRate(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-12 text-[#101010] dark:text-white"
                  />
                </div>
              )}
            </div>
          </Card>

          {/* Save Buttons & Alert */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="w-full md:w-auto py-4 px-8 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
              id="profile_save_btn2"
            >
              <Save className="w-5 h-5" />
              SAUVEGARDER CONFIGURATION PROFIL FBO
            </button>
          </div>

          {profileSaved && (
            <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs rounded-2xl text-center select-none animate-pulse">
              🎉 PROFIL FBO ENREGISTRÉ ET MIS À JOUR FINEMENT !
            </div>
          )}

        </form>
      </div>

    </div>
  );
};
