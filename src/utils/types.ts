export interface ServiceItem {
  name: string;
  description?: string; // Aggiunto per le note sotto il servizio
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

export interface QuoteService {
  id: string;
  name: string;
  description: string; // Aggiunto
  qty: number;
  unitPrice: number;
}

export interface ClientInfo {
  name: string;
  address: string; // Aggiunto
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
  documentType: 'preventivo' | 'contratto'; // Aggiunto
  paymentMethod: 'contanti' | 'bonifico'; // Aggiunto
}