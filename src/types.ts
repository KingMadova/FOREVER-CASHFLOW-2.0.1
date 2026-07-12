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
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitCC: number;
  isDiscounted: boolean; // Si Client Privilégié (-5%) par exemple
}

export enum OrderStatus {
  PENDING = 'PENDING',
  VALIDATED = 'VALIDATED',
  CANCELLED = 'CANCELLED'
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  date: string;
  items: OrderItem[];
  status: OrderStatus;
  totalRetail: number;
  totalCost: number;
  totalMargin: number;
  totalCC: number;
  discountPercent?: number;
  synced?: boolean;
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
  mtnMoney?: string;
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
  orderId?: string;
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
