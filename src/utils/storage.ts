/**
 * storage.ts — Strato di persistenza ibrido
 *
 * Strategia: "local-first with cloud sync"
 * - Tutte le letture vengono prima dal localStorage (istantanee, offline-safe)
 * - Tutte le scritture vanno sia su localStorage (immediato) sia su Supabase (asincrono)
 * - Al mount dell'app, i dati Supabase sovrascrivono la cache locale (se più recenti)
 *
 * I componenti che usano getQuotes/saveQuote/etc. NON cambiano — stessa API.
 * La sincronizzazione con Supabase avviene tramite useAppData (App.tsx).
 */

import type { Quote, CompanySettings, CatalogItem } from './types';
import defaultCatalog from '../data/defaultCatalog.json';

import {
  dbGetQuotes,
  dbSaveQuote,
  dbDeleteQuote,
  dbGetSettings,
  dbSaveSettings,
  dbGetCatalog,
  dbSaveCatalog,
  dbNextQuoteId,
  dbGetLocations,
  dbSaveLocation,
  dbDeleteLocation,
} from './db';

// ─── localStorage keys ───────────────────────────────────────────────────────
const QUOTES_KEY               = 'preventivi_quotes';
const COUNTER_KEY              = 'preventivi_counter';
const SETTINGS_KEY             = 'preventivi_settings';
const CATALOG_KEY              = 'preventivi_catalog';
const CATALOG_API_KEY          = 'preventivi_catalog_api';
const CATALOG_API_TIMESTAMP_KEY = 'preventivi_catalog_api_timestamp';
const LOCATIONS_KEY            = 'preventivi_locations';

const CATALOG_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CATALOG_API_URL      = 'https://www.movidaintour.it/_functions/catalogo';

const CORS_PROXIES: Array<(url: string) => { proxyUrl: string; extract: (r: Response) => Promise<string> }> = [
  (url) => ({
    proxyUrl: `https://corsproxy.io/?${encodeURIComponent(url)}`,
    extract: (r) => r.text(),
  }),
  (url) => ({
    proxyUrl: `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    extract: async (r) => { const j = await r.json(); return (j.contents as string) ?? ''; },
  }),
  (url) => ({
    proxyUrl: `https://thingproxy.freeboard.io/fetch/${url}`,
    extract: (r) => r.text(),
  }),
];
const PROXY_TIMEOUT_MS = 6000;

// ─────────────────────────────────────────────────────────────────────────────
// QUOTES — local cache (lettura sincrona)
// ─────────────────────────────────────────────────────────────────────────────

export function getQuotes(): Quote[] {
  try { return JSON.parse(localStorage.getItem(QUOTES_KEY) || '[]'); } catch { return []; }
}

/** Scrive su localStorage E su Supabase (fire-and-forget) */
export function saveQuote(quote: Quote): void {
  // 1. Aggiorna cache locale immediatamente
  const quotes = getQuotes();
  const idx = quotes.findIndex(q => q.id === quote.id);
  if (idx >= 0) quotes[idx] = quote; else quotes.unshift(quote);
  localStorage.setItem(QUOTES_KEY, JSON.stringify(quotes));

  // 2. Sync Supabase in background
  dbSaveQuote(quote).catch(err =>
    console.error('[storage] saveQuote sync error:', err)
  );
}

/** Elimina da localStorage E da Supabase */
export function deleteQuote(id: string): void {
  localStorage.setItem(QUOTES_KEY, JSON.stringify(getQuotes().filter(q => q.id !== id)));
  dbDeleteQuote(id).catch(err =>
    console.error('[storage] deleteQuote sync error:', err)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QUOTE ID — atomico via Supabase, con fallback locale
// ─────────────────────────────────────────────────────────────────────────────

/** Peek: restituisce il prossimo ID senza consumarlo (solo cache locale) */
export function getNextQuoteId(): string {
  const counter = parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10) + 1;
  return `PREV-${String(counter).padStart(3, '0')}`;
}

/**
 * Consuma il prossimo ID (incrementa il counter).
 * Usa Supabase per l'atomicità, fallback locale se offline.
 * ATTENZIONE: è asincrona — usata solo in NewQuote prima del salvataggio.
 */
export async function consumeQuoteIdAsync(): Promise<string> {
  return dbNextQuoteId();
}

/** Versione sincrona legacy (incrementa solo il counter locale) */
export function consumeQuoteId(): void {
  const counter = parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10) + 1;
  localStorage.setItem(COUNTER_KEY, String(counter));
}

export function generateQuoteId(): string {
  const counter = parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10) + 1;
  localStorage.setItem(COUNTER_KEY, String(counter));
  return `PREV-${String(counter).padStart(3, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY QUOTE
// ─────────────────────────────────────────────────────────────────────────────

export function getEmptyQuote(): Omit<Quote, 'id' | 'createdAt'> {
  return {
    client: { name: '', address: '', phone: '', eventType: '', location: '', date: '', timeFrom: '', timeTo: '' },
    services: [],
    discount: 0,
    selectedNotes: [],
    notes: '',
    status: 'draft',
    documentType: 'preventivo',
    paymentMethod: 'contanti',
    promoLocale: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: CompanySettings = {
  name:        'Movida in Tour',
  address:     'Sede Legale: Via S. De Vita 10 - 84080 | Logistica: Via D. Somma 2 - 84081 Acquamela',
  vat:         'P.IVA 05466060652 | CCIAA 312772 | ENPALS 56010',
  phone:       '089.9645500 - 338.1201219',
  email:       'info@movidaintour.it',
  website:     'www.movidaintour.it',
  iban:        'IT59 5030 6915 2161 0000 0013 015',
  logoBase64:  '',
  invoiceText: 'DA COMPILARE PER FATTURA ELETTRONICA: P.IVA/C.F. _____________________ CODICE SDI / PEC _____________________',
};

export function getSettings(): CompanySettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* usa default */ }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: CompanySettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  dbSaveSettings(settings).catch(err =>
    console.error('[storage] saveSettings sync error:', err)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCATIONS
// ─────────────────────────────────────────────────────────────────────────────

export function getSavedLocations(): string[] {
  try { return JSON.parse(localStorage.getItem(LOCATIONS_KEY) || '[]'); } catch { return []; }
}

export function saveLocation(location: string): void {
  if (!location.trim()) return;
  const normalized = location.trim().toUpperCase();
  const locs = getSavedLocations().filter(l => l !== normalized);
  locs.unshift(normalized);
  localStorage.setItem(LOCATIONS_KEY, JSON.stringify(locs.slice(0, 50)));
  dbSaveLocation(normalized).catch(() => {/* silent */});
}

export function deleteLocation(location: string): void {
  localStorage.setItem(LOCATIONS_KEY, JSON.stringify(getSavedLocations().filter(l => l !== location)));
  dbDeleteLocation(location).catch(() => {/* silent */});
}

// ─────────────────────────────────────────────────────────────────────────────
// CATALOG — con override Supabase
// ─────────────────────────────────────────────────────────────────────────────

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
    return raw ? JSON.parse(raw) as CatalogItem[] : null;
  } catch { return null; }
}

function writeApiCache(items: CatalogItem[]): void {
  try {
    localStorage.setItem(CATALOG_API_KEY, JSON.stringify(items));
    localStorage.setItem(CATALOG_API_TIMESTAMP_KEY, String(Date.now()));
  } catch { /* ignore quota */ }
}

export function getCatalogItems(): CatalogItem[] {
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    if (raw) return JSON.parse(raw) as CatalogItem[];
  } catch { /* use fallback */ }
  const cached = readApiCache();
  if (cached && cached.length > 0) return cached;
  return defaultCatalog as CatalogItem[];
}

export function saveCatalogItems(items: CatalogItem[]): void {
  localStorage.setItem(CATALOG_KEY, JSON.stringify(items));
  // Sincronizza con Supabase
  dbSaveCatalog(items).catch(err =>
    console.error('[storage] saveCatalog sync error:', err)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CATALOG — fetch dall'API Wix (con proxy CORS cascade) — invariato
// ─────────────────────────────────────────────────────────────────────────────

function parseWixPrice(raw: string | undefined): number {
  if (!raw) return 0;
  const match = raw.replace(/\./g, '').match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapWixItemToCatalogItem(item: Record<string, any>, tag: string): CatalogItem {
  return {
    id:      item._id || crypto.randomUUID(),
    name:    `[${tag}] ${(item.title || 'Servizio').trim().toUpperCase()}`,
    details: item.subtitle || '',
    notes:   item.itemPageText || item.categoria || '',
    price:   parseWixPrice(item.prezzo),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapApiResponse(data: any[][]): CatalogItem[] {
  const tagMap: Record<number, string> = { 0: 'ADULTI', 1: 'BIMBI' };
  const items: CatalogItem[] = [];
  data.forEach((group, i) => {
    const tag = tagMap[i] ?? `GRUPPO-${i + 1}`;
    if (!Array.isArray(group)) return;
    group.forEach(item => {
      if (!item || typeof item !== 'object') return;
      items.push(mapWixItemToCatalogItem(item, tag));
    });
  });
  return items;
}

async function fetchViaProxy(): Promise<string | null> {
  for (let i = 0; i < CORS_PROXIES.length; i++) {
    const { proxyUrl, extract } = CORS_PROXIES[i](CATALOG_API_URL);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
      const res = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const text = await extract(res);
      if (!text?.trim()) continue;
      return text;
    } catch { /* next proxy */ }
  }
  return null;
}

export async function fetchCatalogFromApi(force = false): Promise<{
  items: CatalogItem[];
  source: 'api' | 'cache' | 'local';
  updatedAt: Date | null;
}> {
  if (!force && isCacheValid()) {
    const cached = readApiCache();
    if (cached?.length) {
      const ts = localStorage.getItem(CATALOG_API_TIMESTAMP_KEY);
      return { items: cached, source: 'cache', updatedAt: ts ? new Date(parseInt(ts, 10)) : null };
    }
  }

  const rawText = await fetchViaProxy();
  if (rawText) {
    try {
      const data = JSON.parse(rawText);
      if (!Array.isArray(data)) throw new Error('not array');
      const items = mapApiResponse(data as unknown[][]);
      if (items.length > 0) {
        writeApiCache(items);
        return { items, source: 'api', updatedAt: new Date() };
      }
    } catch { /* fall through */ }
  }

  const cached = readApiCache();
  if (cached?.length) {
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

// ─────────────────────────────────────────────────────────────────────────────
// SYNC INIZIALE — chiamato da App al mount
// Scarica i dati Supabase e aggiorna il localStorage (source of truth remota)
// ─────────────────────────────────────────────────────────────────────────────

export interface SyncResult {
  quotes: Quote[];
  settings: CompanySettings;
  catalogItems: CatalogItem[];
  locations: string[];
}

export async function syncFromSupabase(): Promise<SyncResult> {
  const [quotes, remoteSettings, remoteCatalog, remoteLocations] = await Promise.allSettled([
    dbGetQuotes(),
    dbGetSettings(),
    dbGetCatalog(),
    dbGetLocations(),
  ]);

  // Quotes: sovrascrive locale con dati remoti
  const remoteQuotes = quotes.status === 'fulfilled' ? quotes.value : [];
  if (remoteQuotes.length > 0) {
    localStorage.setItem(QUOTES_KEY, JSON.stringify(remoteQuotes));
  }

  // Settings: unisci (remote ha priorità, ma se vuoto usa locale)
  let finalSettings = getSettings();
  if (remoteSettings.status === 'fulfilled' && remoteSettings.value) {
    finalSettings = remoteSettings.value;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(finalSettings));
  }

  // Catalog: se Supabase ha dati, usali come override
  let finalCatalog = getCatalogItems();
  if (remoteCatalog.status === 'fulfilled' && remoteCatalog.value && remoteCatalog.value.length > 0) {
    finalCatalog = remoteCatalog.value;
    localStorage.setItem(CATALOG_KEY, JSON.stringify(finalCatalog));
  }

  // Locations: merge (unione, rimuove duplicati, locale ha priorità temporale)
  let finalLocations = getSavedLocations();
  if (remoteLocations.status === 'fulfilled') {
    const merged = Array.from(new Set([
      ...finalLocations,
      ...remoteLocations.value,
    ])).slice(0, 50);
    finalLocations = merged;
    localStorage.setItem(LOCATIONS_KEY, JSON.stringify(merged));
  }

  return {
    quotes: remoteQuotes.length > 0 ? remoteQuotes : getQuotes(),
    settings: finalSettings,
    catalogItems: finalCatalog,
    locations: finalLocations,
  };
}