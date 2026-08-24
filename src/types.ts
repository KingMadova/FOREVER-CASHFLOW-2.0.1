export enum CustomerStatus {
  PROSPECT = 'PROSPECT',
  CLIENT = 'CLIENT'
}

export type PipelineStage =
  | 'CONTACT_INITIATED' // Contact initialisé
  | 'PRESENTATION_DONE' // Présentation effectuée
  | 'FOLLOW_UP_REQUIRED' // Suivi nécessaire
  | 'CLOSED_WON' // Vente conclue
  | 'CLOSED_LOST'; // Perdu

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  ville?: string;                    // Ville (Notion)
  dateNaissance?: string;            // Date anniversaire
  sourceProspection?: 'META_ADS' | 'RECOMMANDATION' | 'BOUCHE_OREILLE' | 'EVENEMENT' | 'AUTRE'; // Canal acquisition
  status: CustomerStatus;
  pipelineStage: PipelineStage;
  lastContactDate: string;
  createdAt: string;
  notes?: string;
  synced?: boolean;
}

export interface Product {
  id: string;
  name: string;
  prixRetail: number; // en FCFA
  unitCC: number;     // Case Credits (valeur FLP)
  unitPV?: number;     // Points Volume (FLP) - optionnel, calculé si absent
}

export type OrderType = 'UNITE' | 'PACK' | 'KIT';
export type OrderCanal = 'WHATSAPP' | 'META_ADS' | 'RECOMMANDATION' | 'BOUCHE_OREILLE' | 'EVENEMENT' | 'AUTRE';
export type OrderPaiement = 'AIRTEL' | 'MTN' | 'ESPECES' | 'MIXTE' | 'VIREMENT' | 'AUTRE';
export type OrderGeste = 'AUCUN' | 'CLEAN9_-7K' | 'LIVRAISON_GRATUITE' | 'FIELDS_OFFERT' | 'REMISE_5' | 'AUTRE';
export type LivraisonMode = 'DOMICILE' | 'POINT_RELAIS' | 'MAIN_PROPRE' | 'RETRAIT_BOUTIQUE';
export type OrderStatut = 'PENDING' | 'VALIDATED' | 'PAYE' | 'LIVRE' | 'CANCELLED' | 'RETOUR' | 'REMPLACEMENT';

export interface Livraison {
  mode: LivraisonMode;
  frais: number;
  datePrevue: string;
  dateReelle?: string;
  transporteur?: string;
  adresseLivraison?: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitCC: number;
  unitPV?: number;
  isDiscounted: boolean; // Si Client Privilégié (-5%) par exemple
  estPack?: boolean;           // Si cet item est un pack prédéfini
  packId?: string;             // Référence vers pack prédéfini
}

export enum OrderStatus {
  PENDING = 'PENDING',
  VALIDATED = 'VALIDATED',
  CANCELLED = 'CANCELLED',
  PAYE = 'PAYE',
  LIVRE = 'LIVRE',
  RETOUR = 'RETOUR',
  REMPLACEMENT = 'REMPLACEMENT'
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  date: string;
  validatedAt?: string;
  items: OrderItem[];
  status: OrderStatut;
  totalRetail: number;
  totalCost: number;
  totalMargin: number;
  amountPaid?: number;          // Montant réellement perçu du client (après négociation)
  totalCC: number;
  totalPV: number;              // Case Credits × ratio PV/CC (FLP)
  totalBV: number;              // Business Volume
  discountPercent?: number;
  synced?: boolean;

  // Nouveaux champs Notion/Obsidian
  type: OrderType;              // UNITE | PACK | KIT
  canal: OrderCanal;            // Canal acquisition
  paiement: OrderPaiement;      // Mode paiement
  refPaiement?: string;         // Transaction ID Mobile Money
  encaissementDate?: string;    // Date réelle encaissement
  refCommande: string;          // CMD-YYYYMMDD-XXX (auto)
  geste: OrderGeste;            // Geste commercial
  gesteMontant?: number;        // Montant du geste en FCFA
  livraison: Livraison;         // Infos livraison
  delaiLivraison?: number;      // Calculé: dateReelle - date (jours)
  satisfaction?: 1 | 2 | 3 | 4 | 5;
  satisfactionNote?: string;
  satisfactionDate?: string;
  recommandation: boolean;
  recommandationClientId?: string;
  distributeurId: string;       // Par défaut = ton userId
  tags: string[];
  notes?: string;
}

export type GradeCode = 'AA' | 'A' | 'MA' | 'M';

export interface Grade {
  code: GradeCode;
  label: string;
  tauxRemise: number;
}

export const GRADES: Grade[] = [
  { code: 'AA', label: 'Assistant Animateur', tauxRemise: 0.30 },
  { code: 'A',  label: 'Animateur',           tauxRemise: 0.38 },
  { code: 'MA', label: 'Manager Adjoint',     tauxRemise: 0.43 },
  { code: 'M',  label: 'Manager',             tauxRemise: 0.48 },
];

export interface PackSlot {
  produit: Product;
  ratio: number;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface UserProfile {
  name: string;
  title: string;
  grade: GradeCode;
  initials: string;
  photoUrl?: string;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  siret?: string;
  fboId?: string;
  bankRIB?: string;
  airtelMoney?: string;   // Airtel Money Congo
  mtnMoney?: string;     // MTN Mobile Money Congo
  tvaRate?: number;
  tvaApplicable?: boolean;
  themeMode?: string;
  monthlyGoalCC?: number;
  monthlyGoalAmount?: number;
  createdAt?: string;
  updatedAt?: string;
}

// Budget entries
export interface BudgetEntry {
  id: string;
  type: 'REVENUE' | 'EXPENSE';
  category: string;
  amount: number;
  date: string;
  description: string;
  createdAt: string;
  userId?: string;
  orderId?: string;             // Lien vers la commande source (marge vente)
  synced?: boolean;             // false = créé hors-ligne, en attente de sync
}

// Global App State type
export interface AgendaItem {
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

// Journal quotidien G4 - Tracker d'activité Excellente Vie
export interface DailyLog {
  id: string;          // format YYYY-MM-DD (clé unique par jour)
  date: string;        // YYYY-MM-DD

  // === CHECKLIST QUOTIDIENNE (cocher) ===
  consumedProduct: boolean;     // Consommation produit du jour
  trained: boolean;             // Formation 30 min
  statusMorning: boolean;       // Statut WhatsApp 06h-08h
  statusNoon: boolean;          // Statut WhatsApp 12h-14h
  statusEvening: boolean;       // Statut WhatsApp 18h-20h

  // === COMPTEURS MANUELS DU JOUR ===
  contactsAdded: number;        // Nouveaux contacts ajoutés (objectif : 5/jour)
  conversationsStarted: number; // Conversations lancées (objectif : 100/jour)
  followUpsDone: number;        // Suivis effectués

  // === PRÉSENTATIONS DU JOUR (hebdomadaire via cumul) ===
  oneToOne: number;             // One-to-One
  miniConferences: number;      // Mini-conférences (3-5 personnes)
  conferences: number;          // Conférences (6+ personnes)
  boutiques: number;            // Boutiques à domicile

  // Métadonnées
  userId: string;              // Propriétaire du document (règles Firestore)
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppStoreState {
  themeMode: ThemeMode;
  profile: UserProfile;
  customers: Customer[];
  orders: Order[];
  budget: BudgetEntry[];
  products: Product[];
  agenda: AgendaItem[];
}