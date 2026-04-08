export interface ServiceItem {
  name: string;
  details?: string;
  notes?: string;
  qty: number;
  price: number;
}

export interface Package {
  name: string;
  price: number;
  items: ServiceItem[];
}

export interface ServiceCategory {
  category: string;
  packages: Package[];
}

export interface CatalogItem {
  id: string;
  name: string;
  details: string;
  notes: string;
  price: number;
}

export interface QuoteService {
  id: string;
  name: string;
  details: string;
  notes: string;
  qty: number;
  unitPrice: number;
  itemDiscount?: number;
  omaggio?: boolean;   // se true → riga resa gratis, importo 0 sul PDF
}

export interface ClientInfo {
  name: string;
  address: string;
  phone: string;
  eventType: string;
  location: string;
  date: string;
  timeFrom: string;
  timeTo: string;
}

export interface CompanySettings {
  name: string;
  address: string;
  vat: string;
  phone: string;
  email: string;
  website: string;
  iban: string;
  logoBase64: string;
  invoiceText?: string;
}

// ─── Note a piè di pagina ────────────────────────────────────────────────────
export const DEFAULT_FOOTER_NOTES: string[] = [
  'IN ORDINE DI IMPORTANZA',
  'ONERI SIAE A CARICO DEL CLIENTE/STRUTTURA',
  'DURANTE LA CERIMONIA LE ATTIVITÀ DI ANIMAZIONE, CONTROLLO E ASSISTENZA VERRANNO GARANTITE SOLO AI BAMBINI DAI 3 ANNI IN SU',
  'IL MENÙ BAMBINI PER GLI ANIMATORI È A CARICO DEL CLIENTE',
  'DURANTE LA MANIFESTAZIONE, LE ATTIVITÀ DI ASSISTENZA E CONTROLLO DEI BAMBINI PARTECIPANTI, NON SONO A NOSTRO CARICO',
  'IN CASO DI CONDIZIONI ATMOSFERICHE AVVERSE I GIOCHI SARANNO ADATTATI NEGLI SPAZI INTERNI',
  "IN MANCANZA DI QUESTI IN MODALITÀ STATICA AL TAVOLO IN ATTESA DI RIPRENDERE ALL'ESTERNO",
];

// Scritta legale che appare SEMPRE in fondo ad ogni documento
export const LEGAL_CLOSING =
  'Il presente documento ha validità legale anche senza firma autografa e si intende accettato al momento del ricevimento.';

export interface Quote {
  id: string;
  createdAt: string;
  client: ClientInfo;
  services: QuoteService[];
  discount: number;
  selectedNotes: string[];   // note checkbox selezionate
  notes: string;             // testo libero aggiuntivo
  status: 'draft' | 'sent' | 'confirmed';
  documentType: 'preventivo' | 'contratto';
  paymentMethod: 'contanti' | 'bonifico';
  promoLocale: boolean;      // nasconde importi → "PROMO LOCALE"
}

export type View = 'dashboard' | 'new' | 'quotes' | 'catalog' | 'settings';