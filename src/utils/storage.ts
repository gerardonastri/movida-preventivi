import type { Quote, CompanySettings, CatalogItem } from './types';
// IMPORTIAMO IL TUO NUOVO CATALOGO BASE
import defaultCatalog from '../data/defaultCatalog.json';

const QUOTES_KEY = 'preventivi_quotes';
const COUNTER_KEY = 'preventivi_counter';
const SETTINGS_KEY = 'preventivi_settings';
const CATALOG_KEY = 'preventivi_catalog'; 

export function getQuotes(): Quote[] {
  try { return JSON.parse(localStorage.getItem(QUOTES_KEY) || '[]'); } catch { return []; }
}
export function saveQuote(quote: Quote): void {
  const quotes = getQuotes();
  const idx = quotes.findIndex(q => q.id === quote.id);
  if (idx >= 0) quotes[idx] = quote; else quotes.unshift(quote);
  localStorage.setItem(QUOTES_KEY, JSON.stringify(quotes));
}
export function deleteQuote(id: string): void {
  localStorage.setItem(QUOTES_KEY, JSON.stringify(getQuotes().filter(q => q.id !== id)));
}

export function generateQuoteId(): string {
  const counter = parseInt(localStorage.getItem(COUNTER_KEY) || '0') + 1;
  localStorage.setItem(COUNTER_KEY, String(counter));
  return `PREV-${String(counter).padStart(3, '0')}`;
}
export function getNextQuoteId(): string {
  const counter = parseInt(localStorage.getItem(COUNTER_KEY) || '0') + 1;
  return `PREV-${String(counter).padStart(3, '0')}`;
}
export function consumeQuoteId(): void {
  const counter = parseInt(localStorage.getItem(COUNTER_KEY) || '0') + 1;
  localStorage.setItem(COUNTER_KEY, String(counter));
}

export function getEmptyQuote(): Omit<Quote, 'id' | 'createdAt'> {
  return {
    client: { name: '', address: '', phone: '', eventType: '', location: '', date: '', timeFrom: '', timeTo: '' },
    services: [], discount: 0, notes: '', status: 'draft', documentType: 'preventivo', paymentMethod: 'contanti'
  };
}

export function getSettings(): CompanySettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error("Errore nel parsing delle impostazioni:", e);
  }
  return {
    name: 'Movida in Tour', address: 'Sede Legale: Via S. De Vita 10 - 84080 | Logistica: Via D. Somma 2 - 84081 Acquamela',
    vat: 'P.IVA 05466060652 | CCIAA 312772 | ENPALS 56010', phone: '089.9645500 - 338.1201219',
    email: 'info@movidaintour.it', website: 'www.movidaintour.it', iban: 'IT59 5030 6915 2161 0000 0013 015', logoBase64: ''
  };
}
export function saveSettings(settings: CompanySettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// --- NUOVE FUNZIONI CATALOGO ---
export function getCatalogItems(): CatalogItem[] {
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    // Se l'utente ha modificato il catalogo nell'app, usa quello
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error("Errore nel parsing del catalogo:", e);
  }
  // Altrimenti, usa il file JSON perfetto che abbiamo appena creato!
  return defaultCatalog as CatalogItem[];
}
export function saveCatalogItems(items: CatalogItem[]): void {
  localStorage.setItem(CATALOG_KEY, JSON.stringify(items));
}