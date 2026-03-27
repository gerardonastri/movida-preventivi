export interface ServiceItem {
  name: string;
  details?: string; // Sostituisce la vecchia description
  notes?: string;   // Aggiunto per le note aggiuntive sotto il dettaglio
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

// NUOVO: Interfaccia per il database del Catalogo
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
  details: string; // Aggiornato
  notes: string;   // Aggiornato
  qty: number;
  unitPrice: number;
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
}

export interface Quote {
  id: string;
  createdAt: string;
  client: ClientInfo;
  services: QuoteService[];
  discount: number;
  notes: string;
  status: 'draft' | 'sent' | 'confirmed';
  documentType: 'preventivo' | 'contratto';
  paymentMethod: 'contanti' | 'bonifico';
}

// AGGIUNTO: Esportiamo il tipo View in modo che Sidebar e App lo possano usare
export type View = 'dashboard' | 'new' | 'quotes' | 'catalog' | 'settings';