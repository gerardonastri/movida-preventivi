import type { Quote, CompanySettings, CatalogItem } from './types';
import defaultCatalog from '../data/defaultCatalog.json';

const QUOTES_KEY = 'preventivi_quotes';
const COUNTER_KEY = 'preventivi_counter';
const SETTINGS_KEY = 'preventivi_settings';
const CATALOG_KEY = 'preventivi_catalog';
const CATALOG_API_KEY = 'preventivi_catalog_api';
const CATALOG_API_TIMESTAMP_KEY = 'preventivi_catalog_api_timestamp';
const LOCATIONS_KEY = 'preventivi_locations';

const CATALOG_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CATALOG_API_URL = 'https://www.movidaintour.it/_functions/catalogo';

const CORS_PROXIES: Array<(url: string) => { proxyUrl: string; extract: (r: Response) => Promise<string> }> = [
  (url) => ({
    proxyUrl: `https://corsproxy.io/?${encodeURIComponent(url)}`,
    extract: (r) => r.text(),
  }),
  (url) => ({
    proxyUrl: `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    extract: async (r) => {
      const json = await r.json();
      return (json.contents as string) ?? '';
    },
  }),
  (url) => ({
    proxyUrl: `https://thingproxy.freeboard.io/fetch/${url}`,
    extract: (r) => r.text(),
  }),
];

const PROXY_TIMEOUT_MS = 6000;

// ---------------------------------------------------------------------------
// QUOTES
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// QUOTE ID
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// EMPTY QUOTE — nessuna nota predefinita
// ---------------------------------------------------------------------------

export function getEmptyQuote(): Omit<Quote, 'id' | 'createdAt'> {
  return {
    client: { name: '', address: '', phone: '', eventType: '', location: '', date: '', timeFrom: '', timeTo: '' },
    services: [],
    discount: 0,
    acconto: 0,          // <-- AGGIUNTO QUI
    selectedNotes: [],   // nessuna nota preselezionata
    notes: '',           // nessun testo libero predefinito
    status: 'draft',
    documentType: 'preventivo',
    paymentMethod: 'contanti',
    promoLocale: false,
  };
}

// ---------------------------------------------------------------------------
// SETTINGS
// ---------------------------------------------------------------------------

export function getSettings(): CompanySettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Errore nel parsing delle impostazioni:', e);
  }
  return {
    name: 'Movida in Tour',
    address: 'Sede Legale: Via S. De Vita 10 - 84080 | Logistica: Via D. Somma 2 - 84081 Acquamela',
    vat: 'P.IVA 05466060652 | CCIAA 312772 | ENPALS 56010',
    phone: '089.9645500 - 338.1201219',
    email: 'info@movidaintour.it',
    website: 'www.movidaintour.it',
    iban: 'IT59 5030 6915 2161 0000 0013 015',
    logoBase64: '',
    invoiceText: 'DA COMPILARE PER FATTURA ELETTRONICA: P.IVA/C.F. _____________________ CODICE SDI / PEC _____________________',
  };
}

export function saveSettings(settings: CompanySettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// ---------------------------------------------------------------------------
// LOCATIONS
// ---------------------------------------------------------------------------

export function getSavedLocations(): string[] {
  try { return JSON.parse(localStorage.getItem(LOCATIONS_KEY) || '[]'); } catch { return []; }
}

export function saveLocation(location: string): void {
  if (!location.trim()) return;
  const normalized = location.trim().toUpperCase();
  const locs = getSavedLocations().filter(l => l !== normalized);
  locs.unshift(normalized);
  localStorage.setItem(LOCATIONS_KEY, JSON.stringify(locs.slice(0, 50)));
}

export function deleteLocation(location: string): void {
  const locs = getSavedLocations().filter(l => l !== location);
  localStorage.setItem(LOCATIONS_KEY, JSON.stringify(locs));
}

// ---------------------------------------------------------------------------
// CATALOG — MAPPING
// ---------------------------------------------------------------------------

function parseWixPrice(raw: string | undefined): number {
  if (!raw) return 0;
  const match = raw.replace(/\./g, '').match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function mapWixItemToCatalogItem(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  item: Record<string, any>,
  categoryTag: string
): CatalogItem {
  const title: string = (item.title || 'Servizio').trim().toUpperCase();
  const name = `[${categoryTag}] ${title}`;
  const details: string = item.subtitle || '';
  const notes: string = item.itemPageText || item.categoria || '';
  const price = parseWixPrice(item.prezzo);
  const id: string = item._id || crypto.randomUUID();
  return { id, name, details, notes, price };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapApiResponse(data: any[][]): CatalogItem[] {
  const tagMap: Record<number, string> = { 0: 'ADULTI', 1: 'BIMBI' };
  const items: CatalogItem[] = [];
  data.forEach((group, groupIndex) => {
    const tag = tagMap[groupIndex] ?? `GRUPPO-${groupIndex + 1}`;
    if (!Array.isArray(group)) return;
    group.forEach(item => {
      if (!item || typeof item !== 'object') return;
      items.push(mapWixItemToCatalogItem(item, tag));
    });
  });
  return items;
}

// ---------------------------------------------------------------------------
// CATALOG — CACHE
// ---------------------------------------------------------------------------

function isCacheValid(): boolean {
  try {
    const ts = localStorage.getItem(CATALOG_API_TIMESTAMP_KEY);
    if (!ts) return false;
    return Date.now() - parseInt(ts, 10) < CATALOG_CACHE_TTL_MS;
  } catch { return false; }
}

function readApiCache(): CatalogItem[] | null {
  try {
    const raw = localStorage.getItem(CATALOG_API_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CatalogItem[];
  } catch { return null; }
}

function writeApiCache(items: CatalogItem[]): void {
  try {
    localStorage.setItem(CATALOG_API_KEY, JSON.stringify(items));
    localStorage.setItem(CATALOG_API_TIMESTAMP_KEY, String(Date.now()));
  } catch (e) {
    console.warn('Impossibile scrivere la cache del catalogo:', e);
  }
}

// ---------------------------------------------------------------------------
// CATALOG — PUBLIC
// ---------------------------------------------------------------------------

export function getCatalogItems(): CatalogItem[] {
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    if (raw) return JSON.parse(raw) as CatalogItem[];
  } catch (e) {
    console.error('Errore nel parsing del catalogo utente:', e);
  }
  const cached = readApiCache();
  if (cached && cached.length > 0) return cached;
  return defaultCatalog as CatalogItem[];
}

export function saveCatalogItems(items: CatalogItem[]): void {
  localStorage.setItem(CATALOG_KEY, JSON.stringify(items));
}

async function fetchViaProxy(): Promise<string | null> {
  for (let i = 0; i < CORS_PROXIES.length; i++) {
    const buildProxy = CORS_PROXIES[i];
    const { proxyUrl, extract } = buildProxy(CATALOG_API_URL);
    try {
      console.log(`[Catalog] Proxy ${i + 1}/${CORS_PROXIES.length}: ${proxyUrl}`);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
      const response = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok) { console.warn(`[Catalog] Proxy ${i + 1} HTTP ${response.status}`); continue; }
      const text = await extract(response);
      if (!text || text.trim() === '') { console.warn(`[Catalog] Proxy ${i + 1} risposta vuota`); continue; }
      console.log(`[Catalog] Proxy ${i + 1} OK — ${text.length} byte`);
      return text;
    } catch (err) {
      console.warn(`[Catalog] Proxy ${i + 1} fallito: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.error('[Catalog] Tutti i proxy hanno fallito.');
  return null;
}

export async function fetchCatalogFromApi(force = false): Promise<{
  items: CatalogItem[];
  source: 'api' | 'cache' | 'local';
  updatedAt: Date | null;
}> {
  if (!force && isCacheValid()) {
    const cached = readApiCache();
    if (cached && cached.length > 0) {
      const ts = localStorage.getItem(CATALOG_API_TIMESTAMP_KEY);
      return { items: cached, source: 'cache', updatedAt: ts ? new Date(parseInt(ts, 10)) : null };
    }
  }

  const rawText = await fetchViaProxy();
  if (rawText) {
    try {
      const data = JSON.parse(rawText);
      if (!Array.isArray(data)) throw new Error('Risposta non è un array');
      const items = mapApiResponse(data as unknown[][]);
      if (items.length === 0) throw new Error('Array vuoto dopo mapping');
      writeApiCache(items);
      return { items, source: 'api', updatedAt: new Date() };
    } catch (parseErr) {
      console.error('[Catalog] Errore parsing JSON:', parseErr);
    }
  }

  const cached = readApiCache();
  if (cached && cached.length > 0) {
    const ts = localStorage.getItem(CATALOG_API_TIMESTAMP_KEY);
    return { items: cached, source: 'cache', updatedAt: ts ? new Date(parseInt(ts, 10)) : null };
  }
  return { items: defaultCatalog as CatalogItem[], source: 'local', updatedAt: null };
}

export function isCatalogCacheStale(): boolean { return !isCacheValid(); }

export function getCatalogLastSync(): Date | null {
  try {
    const ts = localStorage.getItem(CATALOG_API_TIMESTAMP_KEY);
    return ts ? new Date(parseInt(ts, 10)) : null;
  } catch { return null; }
}