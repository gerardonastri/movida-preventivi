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
  dbDeleteLocation, dbSaveAllFooterNotes,
  dbGetFooterNotes,
  type FooterNote,
} from './db';

import { DEFAULT_FOOTER_NOTES } from './types';

// ─── localStorage keys ───────────────────────────────────────────────────────
const QUOTES_KEY               = 'preventivi_quotes';
const COUNTER_KEY              = 'preventivi_counter';
const SETTINGS_KEY             = 'preventivi_settings';
const CATALOG_KEY              = 'preventivi_catalog';
const CATALOG_API_KEY          = 'preventivi_catalog_api';
const CATALOG_API_TIMESTAMP_KEY = 'preventivi_catalog_api_timestamp';
const LOCATIONS_KEY            = 'preventivi_locations';
const FOOTER_NOTES_KEY         = 'preventivi_footer_notes';

const CATALOG_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CATALOG_API_URL      = 'https://www.movidaintour.it/_functions/catalogo';

// FIX: Rimosso il warning "url is defined but never used"
// Abbiamo trasformato 'url' in '_' per indicare a TS che è un parametro intenzionalmente ignorato nel primo caso,
// oppure puoi semplicemente usare la costante CATALOG_API_URL.
const CORS_PROXIES: Array<(url: string) => { proxyUrl: string; extract: (r: Response) => Promise<string> }> = [
  () => ({
    // 1. Vercel Rewrite (Usa il tunnel configurato in vercel.json)
    proxyUrl: '/api/catalogo',
    extract: (r) => r.text(),
  }),
  (url) => ({
    // 2. AllOrigins (Usa il parametro url che viene passato, ovvero CATALOG_API_URL)
    proxyUrl: `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    extract: async (r) => { 
      const j = await r.json(); 
      return (j.contents as string) ?? ''; 
    },
  })
];
const PROXY_TIMEOUT_MS = 6000;

// ─────────────────────────────────────────────────────────────────────────────
// QUOTES — local cache (lettura sincrona)
// ─────────────────────────────────────────────────────────────────────────────

export function getQuotes(): Quote[] {
  try { return JSON.parse(localStorage.getItem(QUOTES_KEY) || '[]'); } catch { return []; }
}

export function saveQuote(quote: Quote): void {
  const quotes = getQuotes();
  const idx = quotes.findIndex(q => q.id === quote.id);
  if (idx >= 0) quotes[idx] = quote; else quotes.unshift(quote);
  localStorage.setItem(QUOTES_KEY, JSON.stringify(quotes));

  dbSaveQuote(quote).catch(err =>
    console.error('[storage] saveQuote sync error:', err)
  );
}

/**
 * Salva il preventivo SOLO in localStorage — nessuna chiamata a Supabase.
 * Usato dall'autosave silenzioso in NewQuote per salvare bozze locali.
 */
export function localSaveQuote(quote: Quote): void {
  const quotes = getQuotes();
  const idx = quotes.findIndex(q => q.id === quote.id);
  if (idx >= 0) quotes[idx] = quote; else quotes.unshift(quote);
  localStorage.setItem(QUOTES_KEY, JSON.stringify(quotes));
}

export function deleteQuote(id: string): void {
  localStorage.setItem(QUOTES_KEY, JSON.stringify(getQuotes().filter(q => q.id !== id)));
  dbDeleteQuote(id).catch(err =>
    console.error('[storage] deleteQuote sync error:', err)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QUOTE ID — atomico via Supabase, con fallback locale
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera un ID temporaneo locale (solo per visualizzazione prima del salvataggio).
 * Il prefisso dipende dal tipo di documento.
 */
export function getNextQuoteId(documentType: 'preventivo' | 'contratto' = 'preventivo'): string {
  const counter = parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10) + 1;
  const prefix = documentType === 'contratto' ? 'CONTR' : 'PREV';
  return `${prefix}-${String(counter).padStart(3, '0')}`;
}

export async function consumeQuoteIdAsync(): Promise<string> {
  return dbNextQuoteId();
}

export function consumeQuoteId(): void {
  const counter = parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10) + 1;
  localStorage.setItem(COUNTER_KEY, String(counter));
}

export function generateQuoteId(documentType: 'preventivo' | 'contratto' = 'preventivo'): string {
  const counter = parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10) + 1;
  localStorage.setItem(COUNTER_KEY, String(counter));
  const prefix = documentType === 'contratto' ? 'CONTR' : 'PREV';
  return `${prefix}-${String(counter).padStart(3, '0')}`;
}

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
// CATALOG
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
  dbSaveCatalog(items).catch(err =>
    console.error('[storage] saveCatalog sync error:', err)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CATALOG FETCH WIX
// ─────────────────────────────────────────────────────────────────────────────

function parseWixPrice(raw: string | undefined): number {
  if (!raw) return 0;
  const match = raw.replace(/\./g, '').match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function mapWixItemToCatalogItem(item: Record<string, unknown>, tag: string): CatalogItem {
  return {
    id:      (item._id as string | undefined) || crypto.randomUUID(),
    name:    `[${tag}] ${(item.title as string | undefined || 'Servizio').trim().toUpperCase()}`,
    details: (item.subtitle as string | undefined) || '',
    notes:   (item.itemPageText as string | undefined) || (item.categoria as string | undefined) || '',
    price:   parseWixPrice(item.prezzo as string | undefined),
  };
}

function mapApiResponse(data: unknown[][]): CatalogItem[] {
  const tagMap: Record<number, string> = { 0: 'ADULTI', 1: 'BIMBI' };
  const items: CatalogItem[] = [];
  data.forEach((group, i) => {
    const tag = tagMap[i] ?? `GRUPPO-${i + 1}`;
    if (!Array.isArray(group)) return;
    group.forEach(item => {
      if (!item || typeof item !== 'object') return;
      items.push(mapWixItemToCatalogItem(item as Record<string, unknown>, tag));
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
// SYNC INIZIALE
// ─────────────────────────────────────────────────────────────────────────────

export interface SyncResult {
  quotes: Quote[];
  settings: CompanySettings;
  catalogItems: CatalogItem[];
  locations: string[];
  footerNotes: FooterNote[]; 
}

export async function syncFromSupabase(): Promise<SyncResult> {
  const [quotes, remoteSettings, remoteCatalog, remoteLocations, remoteNotesRes] = await Promise.allSettled([
    dbGetQuotes(),
    dbGetSettings(),
    dbGetCatalog(),
    dbGetLocations(),
    dbGetFooterNotes()
  ]);

  const remoteQuotes = quotes.status === 'fulfilled' ? quotes.value : [];
  if (remoteQuotes.length > 0) {
    localStorage.setItem(QUOTES_KEY, JSON.stringify(remoteQuotes));
  }

  let finalSettings = getSettings();
  if (remoteSettings.status === 'fulfilled' && remoteSettings.value) {
    finalSettings = remoteSettings.value;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(finalSettings));
  }

  let finalCatalog = getCatalogItems();
  if (remoteCatalog.status === 'fulfilled' && remoteCatalog.value && remoteCatalog.value.length > 0) {
    finalCatalog = remoteCatalog.value;
    localStorage.setItem(CATALOG_KEY, JSON.stringify(finalCatalog));
  }

  let finalLocations = getSavedLocations();
  if (remoteLocations.status === 'fulfilled') {
    const merged = Array.from(new Set([
      ...finalLocations,
      ...remoteLocations.value,
    ])).slice(0, 50);
    finalLocations = merged;
    localStorage.setItem(LOCATIONS_KEY, JSON.stringify(merged));
  }

  let finalNotes = getFooterNotes();
  const remoteNotes = remoteNotesRes.status === 'fulfilled'
    ? (remoteNotesRes.value as FooterNote[] | null | undefined)
    : null;
  if (Array.isArray(remoteNotes) && remoteNotes.length > 0) {
    finalNotes = remoteNotes;
    localStorage.setItem(FOOTER_NOTES_KEY, JSON.stringify(finalNotes));
  }

  return {
    quotes: remoteQuotes.length > 0 ? remoteQuotes : getQuotes(),
    settings: finalSettings,
    catalogItems: finalCatalog,
    locations: finalLocations,
    footerNotes: finalNotes
  };
}

// ─── FOOTER NOTES ─────────────────────────────────────────────────────────────
// Carica le note a piè di pagina (localStorage come cache, DB come source of truth)
export function getFooterNotes(): FooterNote[] {
  try {
    const raw = localStorage.getItem(FOOTER_NOTES_KEY);
    if (raw) return JSON.parse(raw) as FooterNote[];
  } catch { /* fallback */ }
  // Prima volta: seed dai default
  const defaults: FooterNote[] = DEFAULT_FOOTER_NOTES.map((content, i) => ({
    id: crypto.randomUUID(),
    content,
    sortOrder: i,
  }));
  localStorage.setItem(FOOTER_NOTES_KEY, JSON.stringify(defaults));
  return defaults;
}

export function saveFooterNotes(notes: FooterNote[]): void {
  localStorage.setItem(FOOTER_NOTES_KEY, JSON.stringify(notes));
  dbSaveAllFooterNotes(notes).catch(err =>
    console.error('[storage] saveFooterNotes sync error:', err)
  );
}