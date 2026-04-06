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
  itemDiscount?: number; // FIX: sconto per singolo item (€)
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
  invoiceText?: string; // FIX: testo per richiesta fattura elettronica
}

// FIX: note a piè di pagina predefinite
export const DEFAULT_FOOTER_NOTES = [
  'Autorizzazione utilizzo parco a cura del cliente.',
  'Il servizio è subordinato alle condizioni atmosferiche.',
  'Prezzo comprensivo di allestimento e smontaggio.',
  'Eventuale prolungamento orario da concordare e quotare separatamente.',
  'Acconto del 30% richiesto alla firma del contratto.',
] as const;

export interface Quote {
  id: string;
  createdAt: string;
  client: ClientInfo;
  services: QuoteService[];
  discount: number; // sconto globale sul totale
  notes: string;    // note a piè di pagina
  status: 'draft' | 'sent' | 'confirmed';
  documentType: 'preventivo' | 'contratto';
  paymentMethod: 'contanti' | 'bonifico';
}

export type View = 'dashboard' | 'new' | 'quotes' | 'catalog' | 'settings';