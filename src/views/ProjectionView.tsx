import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Card } from '../components/ui/Card';
import { Product, GRADES } from '../types';
import { 
  Plus,
  Minus,
  Trash2,
  TrendingUp, 
  Share2, 
  Layers, 
  ShoppingBag, 
  Calculator, 
  Sparkles, 
  Copy, 
  CheckCircle2,
  ChevronRight,
  Search
} from 'lucide-react';

interface PackProductSlot {
  product: Product;
  ratio: number; // e.g. 1 unit of pack contains 2 unit of this product
}

interface CustomPack {
  name: string;
  unitCC: number;
  totalRetail: number;
  slots: PackProductSlot[];
}

export const ProjectionView: React.FC = () => {
  const { products, profile } = useStore();

  // 1. Projection calculator state
  const [targetMargin, setTargetMargin] = useState<number>(500000); // en FCFA
  const [activeTab, setActiveTab] = useState<'premade' | 'custom'>('premade');
  const [selectedPackIndex, setSelectedPackIndex] = useState<number>(0);
  const [customPackItems, setCustomPackItems] = useState<Record<string, number>>({});
  const [copied, setCopied] = useState(false);
  const [projProductSearch, setProjProductSearch] = useState('');

  // Remise Grade FBO
  const currentGrade = GRADES.find(g => g.code === profile.grade) || GRADES[1]; // default Animateur (38%)

  // Build standard Pack designs
  const PREMADE_PACKS: CustomPack[] = [
    {
      name: 'Pack C9 Détox Purifiant',
      unitCC: 0.482,
      totalRetail: 98000,
      slots: [
        { product: products[2] || products[0], ratio: 1 }
      ]
    },
    {
      name: 'Pack Énergie & Tonus Actif',
      unitCC: 0.594,
      totalRetail: 111000,
      slots: [
        { product: products[0], ratio: 2 }, // Pulpe d'aloès
        { product: products[1], ratio: 1 }, // Argi+
        { product: products[3], ratio: 1 }  // Toothgel
      ]
    },
    {
      name: 'Pack Beauté & Soin Intense',
      unitCC: 0.273,
      totalRetail: 53700,
      slots: [
        { product: products[5] || products[0], ratio: 1 }, // Propolis Creme
        { product: products[6] || products[0], ratio: 2 }, // Tube Gelly
        { product: products[3] || products[0], ratio: 2 }  // Toothgel
      ]
    }
  ];

  // Synthesize customized pack from state
  const customSlots: PackProductSlot[] = (Object.entries(customPackItems) as [string, number][])
    .filter(([_, qty]) => qty > 0)
    .map(([prodId, qty]) => {
      const prod = products.find(p => p.id === prodId);
      return prod ? { product: prod, ratio: qty } : null;
    })
    .filter((slot): slot is PackProductSlot => slot !== null);

  const customUnitCC = customSlots.reduce((sum, s) => sum + (s.product.unitCC * s.ratio), 0);
  const customTotalRetail = customSlots.reduce((sum, s) => sum + (s.product.prixRetail * s.ratio), 0);
  
  const customPackName = customSlots.length > 0 
    ? "Mon Pack Personnalisé" 
    : "Pack Personnalisé (Vide)";

  const customPack: CustomPack = {
    name: customPackName,
    unitCC: Number(customUnitCC.toFixed(3)),
    totalRetail: customTotalRetail,
    slots: customSlots
  };

  const currentPack = activeTab === 'premade' 
    ? (PREMADE_PACKS[selectedPackIndex] || PREMADE_PACKS[0])
    : customPack;

  // Algorithme:
  // FBO margin of selling 1 unit of pack = Pack retail price * FBO Grade Discount Taux
  const fboMarginPerPack = Math.round(currentPack.totalRetail * currentGrade.tauxRemise);

  // Units required to clear target = target / margin per pack
  const unitsRequired = fboMarginPerPack > 0 ? Math.ceil(targetMargin / fboMarginPerPack) : 0;
  
  // Total Case Credits generated = units required * individual pack CC
  const totalCCGenerated = Number((unitsRequired * currentPack.unitCC).toFixed(3));
  
  // Total Retail Sales Volume
  const totalRetailSalesVolume = unitsRequired * currentPack.totalRetail;

  // Clipboard share output
  const shareString = `🎯 *Forever CashFlow - Mon Plan d'Action* 🎯
-----------------------------------------
• *Objectif Marge* : ${targetMargin.toLocaleString()} FCFA
• *Grade FBO* : ${currentGrade.label} (${Math.round(currentGrade.tauxRemise * 100)}% de marge)
• *Pack de Vente* : ${currentPack.name}
${activeTab === 'custom' ? `• *Composition du Pack personnalisé* :\n${customSlots.map(s => `  - ${s.ratio}x ${s.product.name} (${s.product.prixRetail.toLocaleString()} F / ${s.product.unitCC} CC)`).join('\n')}` : ''}
-----------------------------------------
🚀 *Plan de Vente Requis* :
👉 Vendre exactement *${unitsRequired}* unités de ce pack !
👉 *Volume d'activité généré* : *${totalCCGenerated} CC* !
👉 *Chiffre d’Affaires cumulé* : ${totalRetailSalesVolume.toLocaleString()} FCFA

_Calculé instantanément sur Forever CashFlow CRM_ 🔥`;

  const handleCopyToClipboard = () => {
    if (activeTab === 'custom' && customSlots.length === 0) return;
    navigator.clipboard.writeText(shareString).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('Erreur lors de la copie', err);
    });
  };

  return (
    <div className="space-y-6" id="projection_view_container">
      
      {/* 1. Header block */}
      <div>
        <span className="text-[10px] uppercase font-bold text-amber-500 tracking-wider">Algorithme FLP</span>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">La Salle de Projection Intelligente</h2>
        <p className="text-xs text-slate-500 font-medium">Défiez vos objectifs, obtenez le nombre de packs précis requis pour réussir.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Section: Inputs */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1f1f22]">
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-4 border-b border-slate-100 dark:border-slate-800 pb-2.5 text-left">
              1. Définir votre Objectif Marge
            </h3>

            <div className="space-y-4">
              {/* Target Margin Input Box */}
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1.5">Marge cible souhaitée (FCFA)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={targetMargin}
                    onChange={(e) => setTargetMargin(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-slate-50 dark:bg-[#2a2a2e] border border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 px-4 text-slate-950 dark:text-white font-extrabold text-base focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="e.g. 500000"
                    id="projection_target_margin"
                  />
                  <span className="absolute right-4 top-3.5 text-slate-400 dark:text-slate-500 font-extrabold text-sm">FCFA</span>
                </div>
              </div>

              {/* Slider helper quick settings */}
              <div>
                <span className="text-[10px] uppercase font-extrabold text-slate-400 dark:text-slate-500 tracking-wider">Objectifs Prédéfinis</span>
                <div className="flex gap-2 mt-2">
                  {[200000, 500000, 1000000].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setTargetMargin(val)}
                      className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all border ${
                        targetMargin === val
                          ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                          : 'bg-slate-50 dark:bg-[#2a2a2e] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {val.toLocaleString()} FCFA
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Pack selections */}
          <Card className="p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1f1f22]">
            {/* Custom Tab Header */}
            <div className="flex border-b border-slate-100 dark:border-slate-800 mb-5">
              <button
                type="button"
                onClick={() => setActiveTab('premade')}
                className={`flex-1 pb-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 text-center cursor-pointer ${
                  activeTab === 'premade'
                    ? 'border-amber-500 text-amber-500'
                    : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600'
                }`}
              >
                Packs Prédéfinis
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('custom')}
                className={`flex-1 pb-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'custom'
                    ? 'border-amber-500 text-amber-500'
                    : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600'
                }`}
              >
                Mon Pack Sur-Mesure ✨
              </button>
            </div>

            {activeTab === 'premade' ? (
              <div className="space-y-3">
                {PREMADE_PACKS.map((pk, idx) => {
                  const active = idx === selectedPackIndex;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedPackIndex(idx)}
                      className={`w-full flex items-center justify-between text-left p-4 rounded-3xl border transition-all cursor-pointer ${
                        active
                          ? 'bg-amber-500/10 border-amber-500'
                          : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <h4 className="font-extrabold text-xs text-slate-900 dark:text-slate-100 truncate">{pk.name}</h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 uppercase">
                          Valeur de vente: {pk.totalRetail.toLocaleString()} FCFA
                        </p>
                        
                        {/* Sub slots tags visual */}
                        <div className="flex gap-1.5 flex-wrap mt-2">
                          {pk.slots.map((s, i) => (
                            <span key={i} className="text-[8px] font-bold uppercase py-0.5 px-1.5 bg-slate-200/50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded">
                              {s.ratio}x {s.product.name.split(' ')[0]}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 font-extrabold py-0.5 px-2 rounded-full">
                          {pk.unitCC.toFixed(3)} CC
                        </span>
                        <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-2">
                          +{Math.round(pk.totalRetail * currentGrade.tauxRemise).toLocaleString()} F Marge
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Custom Pack summary header */}
                <div className="flex justify-between items-center bg-slate-50 dark:bg-[#252528] p-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  <div>
                    <p className="text-[9px] font-extrabold uppercase text-slate-400 dark:text-slate-500">
                      Pack en cours
                    </p>
                    <p className="text-xs font-black text-slate-800 dark:text-white mt-0.5">
                      {customSlots.length} produit{customSlots.length > 1 ? 's' : ''} • {customTotalRetail.toLocaleString()} FCFA
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-black px-2.5 py-1 rounded-lg">
                      {customUnitCC.toFixed(3)} CC
                    </span>
                    {customSlots.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setCustomPackItems({})}
                        className="p-1 px-2 text-[10px] bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 rounded-lg font-bold flex items-center gap-1 transition-all border-none cursor-pointer"
                        title="Vider le pack"
                      >
                        <Trash2 className="w-3 h-3" />
                        Vider
                      </button>
                    )}
                  </div>
                </div>

                {/* Search input for custom pack products */}
                <div className="relative mb-3">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                    <Search className="w-4 h-4 text-slate-400" />
                  </span>
                  <input
                    type="text"
                    placeholder="Chercher par nom ou code..."
                    value={projProductSearch}
                    onChange={(e) => setProjProductSearch(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-[#1a1a1d] border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-800 dark:text-white"
                  />
                  {projProductSearch && (
                    <button
                      type="button"
                      onClick={() => setProjProductSearch('')}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 font-bold text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Product search/select scrollbox */}
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 scrollbar-none">
                  {products
                    .filter((p) => 
                      !projProductSearch || 
                      p.name.toLowerCase().includes(projProductSearch.toLowerCase()) || 
                      p.id.includes(projProductSearch)
                    )
                    .map((prod) => {
                      const qty = customPackItems[prod.id] || 0;
                      return (
                        <div 
                          key={prod.id}
                          className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                            qty > 0 
                              ? 'bg-amber-500/5 border-amber-500/50 dark:border-amber-500/40' 
                              : 'bg-slate-50/40 dark:bg-[#202023]/40 border-slate-100 dark:border-slate-800'
                          }`}
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <h4 className="font-extrabold text-[12px] text-slate-800 dark:text-slate-200 leading-snug truncate">{prod.name}</h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] font-black text-slate-900 dark:text-slate-100">
                                {prod.prixRetail.toLocaleString()} FCFA
                              </span>
                              <span className="text-[9px] text-slate-400 dark:text-slate-500">•</span>
                              <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/50 px-1.5 py-0.2 rounded">
                                {prod.unitCC} CC
                              </span>
                              <span className="text-[9px] text-slate-400 dark:text-slate-500">•</span>
                              <span className="text-[9px] text-slate-500 dark:text-slate-400 font-bold">Code {prod.id}</span>
                            </div>
                          </div>

                          {/* Quantity Counter */}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (qty > 0) {
                                  setCustomPackItems(prev => ({ ...prev, [prod.id]: qty - 1 }));
                                }
                              }}
                              className={`w-7 h-7 flex items-center justify-center rounded-full border transition-all cursor-pointer ${
                                qty > 0 
                                  ? 'bg-white dark:bg-slate-850 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 active:scale-90 hover:bg-slate-50 dark:hover:bg-slate-850' 
                                  : 'bg-slate-100 dark:bg-slate-900 border-transparent text-slate-405 dark:text-slate-600 cursor-not-allowed'
                              }`}
                              disabled={qty === 0}
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            
                            <span className={`w-5 text-center text-xs font-black ${qty > 0 ? 'text-amber-500 font-extrabold' : 'text-slate-400 dark:text-slate-600'}`}>
                              {qty}
                            </span>

                            <button
                              type="button"
                              onClick={() => {
                                setCustomPackItems(prev => ({ ...prev, [prod.id]: qty + 1 }));
                              }}
                              className="w-7 h-7 flex items-center justify-center rounded-full border bg-white dark:bg-slate-850 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 active:scale-90 hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer font-bold"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  {products.filter((p) => 
                    !projProductSearch || 
                    p.name.toLowerCase().includes(projProductSearch.toLowerCase()) || 
                    p.id.includes(projProductSearch)
                  ).length === 0 && (
                    <div className="p-4 text-xs text-slate-400 text-center">Aucun produit trouvé</div>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Right Section: Projections results & actions */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="p-6 rounded-[2.5rem] bg-slate-900 text-white shadow-2xl relative overflow-hidden text-left flex flex-col justify-between">
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-amber-500/15 rounded-full blur-3xl"></div>
            
            <div className="relative z-10 space-y-6">
              <div>
                <span className="text-[9px] uppercase font-bold text-amber-500 tracking-wider">Résultats Estimés</span>
                <h3 className="text-lg font-black text-white mt-1 leading-none">Matrice d'Action Requise</h3>
              </div>

              {/* Dynamic target math outputs */}
              <div className="space-y-4 pt-1">
                {activeTab === 'custom' && customSlots.length === 0 ? (
                  <div className="bg-slate-800/80 p-5 rounded-3xl text-center space-y-2 border border-slate-700/30">
                    <p className="text-xs text-amber-400 font-bold">⚠️ Votre pack est vide</p>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      Veuillez ajouter un ou plusieurs produits avec les boutons <span className="text-amber-400 font-bold">+</span> à gauche pour démarrer la projection du pack sur-mesure.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center bg-slate-800/80 p-3.5 rounded-2xl">
                      <div>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Packs à vendre</p>
                        <p className="text-2xl font-black text-amber-500 mt-0.5">{unitsRequired}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Total CC généré</p>
                        <p className="text-2xl font-black text-white mt-0.5">{totalCCGenerated}</p>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Remise Grade ({currentGrade.label}):</span>
                        <span className="text-white font-bold">{Math.round(currentGrade.tauxRemise * 100)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Chiffre d’Affaire Requis:</span>
                        <span className="text-white font-black">{totalRetailSalesVolume.toLocaleString()} FCFA</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-800/80 pt-2.5 mt-2">
                        <span className="text-amber-500 font-bold">Marge Perçue :</span>
                        <span className="text-emerald-400 font-black">
                          {(unitsRequired * fboMarginPerPack).toLocaleString()} FCFA
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Share box summary */}
              {!(activeTab === 'custom' && customSlots.length === 0) && (
                <div className="bg-slate-800 p-3 rounded-2xl text-[10px] text-slate-300 italic divide-y divide-slate-700/50 leading-relaxed">
                  <p className="pb-1">💡 "Mon objectif est de faire {targetMargin.toLocaleString()} FCFA de marge. En vendant {unitsRequired} {currentPack.name}, je génère {totalCCGenerated} CC d'activité !"</p>
                </div>
              )}

              {/* Write WhatsApp Clipboard actions */}
              <button
                type="button"
                onClick={handleCopyToClipboard}
                disabled={activeTab === 'custom' && customSlots.length === 0}
                className={`w-full py-4 font-extrabold rounded-2xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'custom' && customSlots.length === 0
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-705/30'
                    : 'bg-amber-500 hover:bg-amber-600 text-slate-900'
                }`}
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 animate-pulse" />
                    COPIÉ DANS LE PRESSE-PAPIER !
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    COPIER RÉSUMÉ WHATSAPP
                  </>
                )}
              </button>
            </div>
          </Card>
        </div>

      </div>

    </div>
  );
};

