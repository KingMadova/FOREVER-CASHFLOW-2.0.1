// src/lib/format.ts
// Formatage unique des nombres et des montants affichés dans l'interface.
// Règle de la refonte :
//   - séparateur de milliers = espace, décimales = virgule (locale fr-FR) ;
//   - les montants sont arrondis à l'unité et suffixés « F » dans l'UI ;
//   - le libellé complet « FCFA » reste réservé aux exports, en-têtes de
//     colonnes et libellés de champs (voir formatMoneyFCFA).
// Aucune règle métier ici : uniquement de la présentation.

const integerFormatter = new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const ccFormatter = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

/** Remplace les espaces insécables produits par Intl par des espaces normaux. */
const normalize = (value: string): string => value.replace(/[\u202f\u00a0]/g, ' ');

const toFiniteNumber = (value: number | null | undefined): number => {
  const n = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** Nombre entier formaté : 1234567 → « 1 234 567 ». */
export function formatNumber(value: number | null | undefined): string {
  return normalize(integerFormatter.format(toFiniteNumber(value)));
}

/** Nombre à deux décimales : 1234.5 → « 1 234,50 ». */
export function formatDecimal(value: number | null | undefined): string {
  return normalize(decimalFormatter.format(toFiniteNumber(value)));
}

/** Montant en francs, arrondi : 24384 → « 24 384 F ». */
export function formatMoney(value: number | null | undefined): string {
  return `${formatNumber(value)} F`;
}

/** Montant avec le libellé complet, pour exports et en-têtes : « 24 384 FCFA ». */
export function formatMoneyFCFA(value: number | null | undefined): string {
  return `${formatNumber(value)} FCFA`;
}

/** Montant signé : +9767.56 → « +9 768 F », −1200 → « −1 200 F ». */
export function formatSignedMoney(value: number | null | undefined): string {
  const n = toFiniteNumber(value);
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${formatMoney(Math.abs(n))}`;
}

/** Volume CC à trois décimales : 0.114 → « 0,114 CC ». */
export function formatCC(value: number | null | undefined): string {
  return `${normalize(ccFormatter.format(toFiniteNumber(value)))} CC`;
}
