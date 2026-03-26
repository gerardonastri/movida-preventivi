import type { Quote, CompanySettings } from './types';

const QUOTES_KEY = 'preventivi_quotes';
const COUNTER_KEY = 'preventivi_counter';
const SETTINGS_KEY = 'preventivi_settings';

export function getQuotes(): Quote[] {
  try {
    const raw = localStorage.getItem(QUOTES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveQuote(quote: Quote): void {
  const quotes = getQuotes();
  const idx = quotes.findIndex(q => q.id === quote.id);
  if (idx >= 0) quotes[idx] = quote;
  else quotes.unshift(quote);
  localStorage.setItem(QUOTES_KEY, JSON.stringify(quotes));
}

export function deleteQuote(id: string): void {
  const quotes = getQuotes().filter(q => q.id !== id);
  localStorage.setItem(QUOTES_KEY, JSON.stringify(quotes));
}

export function generateQuoteId(): string {
  const counter = parseInt(localStorage.getItem(COUNTER_KEY) || '0') + 1;
  localStorage.setItem(COUNTER_KEY, String(counter));
  return `PREV-${String(counter).padStart(3, '0')}`;
}

export function getEmptyQuote(): Omit<Quote, 'id' | 'createdAt'> {
  return {
    client: { name: '', address: '', phone: '', eventType: '', location: '', date: '', timeFrom: '', timeTo: '' },
    services: [], 
    discount: 0, 
    notes: '', 
    status: 'draft',
    documentType: 'preventivo',
    paymentMethod: 'contanti'
  };
}

export function getSettings(): CompanySettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {
    name: 'Movida in Tour',
    address: 'Sede Legale: Via S. De Vita 10 - 84080 | Logistica: Via D. Somma 2 - 84081 Acquamela',
    vat: 'P.IVA 05466060652 | CCIAA 312772 | ENPALS 56010',
    phone: '089.9645500 - 338.1201219',
    email: 'info@movidaintour.it',
    website: 'www.movidaintour.it',
    iban: 'IT59 5030 6915 2161 0000 0013 015',
    logoBase64: ''
  };
}

export function saveSettings(settings: CompanySettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}