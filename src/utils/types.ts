export interface ServiceItem {
  name: string;
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
  qty: number;
  unitPrice: number;
}

export interface ClientInfo {
  name: string;
  phone: string;
  eventType: string;
  location: string;
  date: string;
  time: string;
}

export interface Quote {
  id: string;           // es. "PREV-001"
  createdAt: string;
  client: ClientInfo;
  services: QuoteService[];
  discount: number;     // percentuale 0–100
  notes: string;
  status: 'draft' | 'sent' | 'confirmed';
}

export interface CompanySettings {
  name: string;
  address: string;
  vat: string;
  phone: string;
  email: string;
  website: string;
  iban: string;
  logoUrl: string;
}