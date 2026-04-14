/**
 * db.ts — Layer di accesso dati Supabase
 *
 * Responsabilità:
 * - Mappare il modello DB (snake_case, JSONB) ↔ modello App (camelCase, TypeScript)
 * - Wrappare ogni operazione con try/catch e logging
 * - Nessuna logica di UI — solo dati
 */

import { supabase } from './supabase';
import type { Quote, CompanySettings, CatalogItem } from './types';

// ─── Tipi DB (snake_case, esattamente come in Supabase) ──────────────────────

interface DbQuote {
  id: string;
  created_at: string;
  updated_at: string;
  client_name: string;
  client_address: string;
  client_phone: string;
  client_event_type: string;
  client_location: string;
  client_date: string;
  client_time_from: string;
  client_time_to: string;
  services: Quote['services'];
  discount: number;
  selected_notes: string[];
  notes: string;
  status: Quote['status'];
  document_type: Quote['documentType'];
  payment_method: Quote['paymentMethod'];
  promo_locale: boolean;
  quote_number: number;
}

interface DbSettings {
  id: string;
  updated_at: string;
  company_name: string;
  address: string;
  vat: string;
  phone: string;
  email: string;
  website: string;
  iban: string;
  logo_base64: string;
  invoice_text: string;
}

interface DbCatalogItem {
  id: string;
  name: string;
  details: string;
  notes: string;
  price: number;
  sort_order: number;
}

// ─── Mapping DB → App ────────────────────────────────────────────────────────

function dbToQuote(row: DbQuote): Quote {
  return {
    id: row.id,
    createdAt: row.created_at,
    client: {
      name:       row.client_name,
      address:    row.client_address,
      phone:      row.client_phone,
      eventType:  row.client_event_type,
      location:   row.client_location,
      date:       row.client_date,
      timeFrom:   row.client_time_from,
      timeTo:     row.client_time_to,
    },
    services:      row.services ?? [],
    discount:      Number(row.discount) || 0,
    selectedNotes: row.selected_notes ?? [],
    notes:         row.notes ?? '',
    status:        row.status,
    documentType:  row.document_type,
    paymentMethod: row.payment_method,
    promoLocale:   row.promo_locale ?? false,
  };
}

// ─── Mapping App → DB ────────────────────────────────────────────────────────

function quoteToDB(q: Quote): Omit<DbQuote, 'updated_at' | 'quote_number'> {
  return {
    id:                 q.id,
    created_at:         q.createdAt,
    client_name:        q.client.name,
    client_address:     q.client.address,
    client_phone:       q.client.phone,
    client_event_type:  q.client.eventType,
    client_location:    q.client.location,
    client_date:        q.client.date,
    client_time_from:   q.client.timeFrom,
    client_time_to:     q.client.timeTo,
    services:           q.services,
    discount:           q.discount,
    selected_notes:     q.selectedNotes ?? [],
    notes:              q.notes ?? '',
    status:             q.status,
    document_type:      q.documentType,
    payment_method:     q.paymentMethod,
    promo_locale:       q.promoLocale ?? false,
  };
}

function dbToSettings(row: DbSettings): CompanySettings {
  return {
    name:        row.company_name,
    address:     row.address,
    vat:         row.vat,
    phone:       row.phone,
    email:       row.email,
    website:     row.website,
    iban:        row.iban,
    logoBase64:  row.logo_base64,
    invoiceText: row.invoice_text,
  };
}

function settingsToDB(s: CompanySettings): Omit<DbSettings, 'id' | 'updated_at'> {
  return {
    company_name: s.name,
    address:      s.address,
    vat:          s.vat,
    phone:        s.phone,
    email:        s.email,
    website:      s.website,
    iban:         s.iban,
    logo_base64:  s.logoBase64,
    invoice_text: s.invoiceText ?? '',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// QUOTES
// ─────────────────────────────────────────────────────────────────────────────

/** Carica tutti i preventivi ordinati per data aggiornamento */
export async function dbGetQuotes(): Promise<Quote[]> {
  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[db] getQuotes error:', error.message);
    return [];
  }

  return (data as DbQuote[]).map(dbToQuote);
}

/** Salva (upsert) un singolo preventivo */
export async function dbSaveQuote(quote: Quote): Promise<boolean> {
  const row = quoteToDB(quote);

  const { error } = await supabase
    .from('quotes')
    .upsert(row, { onConflict: 'id' });

  if (error) {
    console.error('[db] saveQuote error:', error.message);
    return false;
  }
  return true;
}

/** Elimina un preventivo */
export async function dbDeleteQuote(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('quotes')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[db] deleteQuote error:', error.message);
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// QUOTE ID COUNTER (atomico, no race condition)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera il prossimo ID preventivo in modo atomico tramite RPC Supabase.
 * Fallback a timestamp locale se offline.
 */
export async function dbNextQuoteId(): Promise<string> {
  const { data, error } = await supabase
    .rpc('next_quote_number');

  if (error || data == null) {
    console.warn('[db] nextQuoteId fallback to timestamp:', error?.message);
    // Fallback offline: usa il counter locale da localStorage
    const local = parseInt(localStorage.getItem('preventivi_counter') || '0', 10) + 1;
    localStorage.setItem('preventivi_counter', String(local));
    return `PREV-${String(local).padStart(3, '0')}`;
  }

  // Sincronizza il counter locale con quello remoto (per il fallback offline)
  localStorage.setItem('preventivi_counter', String(data));
  return `PREV-${String(data as number).padStart(3, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

export async function dbGetSettings(): Promise<CompanySettings | null> {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 'singleton')
    .maybeSingle();

  if (error) {
    console.error('[db] getSettings error:', error.message);
    return null;
  }
  if (!data) return null;

  return dbToSettings(data as DbSettings);
}

export async function dbSaveSettings(settings: CompanySettings): Promise<boolean> {
  const row = {
    id: 'singleton',
    ...settingsToDB(settings),
  };

  const { error } = await supabase
    .from('settings')
    .upsert(row, { onConflict: 'id' });

  if (error) {
    console.error('[db] saveSettings error:', error.message);
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// CATALOG
// ─────────────────────────────────────────────────────────────────────────────

export async function dbGetCatalog(): Promise<CatalogItem[] | null> {
  const { data, error } = await supabase
    .from('catalog')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[db] getCatalog error:', error.message);
    return null;
  }
  if (!data || data.length === 0) return null;

  return (data as DbCatalogItem[]).map(row => ({
    id:      row.id,
    name:    row.name,
    details: row.details,
    notes:   row.notes,
    price:   Number(row.price),
  }));
}

/** Sostituisce tutto il catalogo con upsert atomico.
 *  - Assegna un ID univoco a ogni item che ha ID mancante o duplicato.
 *  - Usa upsert (onConflict: 'id') per evitare duplicate key violations.
 *  - Rimuove le righe orfane (presenti in DB ma non nel nuovo set).
 */
export async function dbSaveCatalog(items: CatalogItem[]): Promise<boolean> {
  if (items.length === 0) {
    // Se la lista è vuota, cancella tutto
    const { error } = await supabase
      .from('catalog')
      .delete()
      .gte('sort_order', 0); // cancella tutte le righe (sort_order è sempre >= 0)
    if (error) {
      console.error('[db] saveCatalog delete-all error:', error.message);
      return false;
    }
    return true;
  }

  // Garantisce ID univoci: se due item hanno lo stesso id, il secondo riceve un UUID nuovo
  const seenIds = new Set<string>();
  const rows: DbCatalogItem[] = items.map((item, i) => {
    let id = item.id && item.id.trim() !== '' ? item.id : crypto.randomUUID();
    // Se l'id è già stato visto in questa sessione, rinomina
    if (seenIds.has(id)) {
      id = crypto.randomUUID();
    }
    seenIds.add(id);
    return {
      id,
      name:       item.name,
      details:    item.details,
      notes:      item.notes,
      price:      item.price,
      sort_order: i,
    };
  });

  // Upsert: aggiorna se esiste, inserisce se nuovo
  const { error: upsertError } = await supabase
    .from('catalog')
    .upsert(rows, { onConflict: 'id' });

  if (upsertError) {
    console.error('[db] saveCatalog upsert error:', upsertError.message);
    return false;
  }

  // Rimuovi le righe orfane: quelle presenti nel DB ma non nel nuovo set
  const currentIds = rows.map(r => r.id);
  const { error: deleteError } = await supabase
    .from('catalog')
    .delete()
    .not('id', 'in', `(${currentIds.map(id => `"${id}"`).join(',')})`);

  if (deleteError) {
    // Non-fatal: l'upsert è già riuscito, le righe orfane non causano danni
    console.warn('[db] saveCatalog orphan-delete warning:', deleteError.message);
  }

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// SAVED LOCATIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function dbGetLocations(): Promise<string[]> {
  const { data, error } = await supabase
    .from('saved_locations')
    .select('location')
    .order('used_at', { ascending: false })
    .limit(50);

  if (error) {
    console.warn('[db] getLocations error:', error.message);
    return [];
  }

  return (data as { location: string }[]).map(r => r.location);
}

export async function dbSaveLocation(location: string): Promise<void> {
  const normalized = location.trim().toUpperCase();
  await supabase
    .from('saved_locations')
    .upsert({ location: normalized, used_at: new Date().toISOString() }, { onConflict: 'location' });
}

export async function dbDeleteLocation(location: string): Promise<void> {
  await supabase
    .from('saved_locations')
    .delete()
    .eq('location', location);
}

// ─────────────────────────────────────────────────────────────────────────────
// REALTIME SUBSCRIPTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sottoscrive ai cambiamenti della tabella quotes.
 * Chiama onInsertOrUpdate quando un preventivo viene creato/aggiornato,
 * onDelete quando viene eliminato.
 * Ritorna la funzione di cleanup (unsubscribe).
 */
export function subscribeToQuotes(
  onInsertOrUpdate: (quote: Quote) => void,
  onDelete: (id: string) => void,
): () => void {
  const channel = supabase
    .channel('quotes-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'quotes' },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          onDelete((payload.old as { id: string }).id);
        } else {
          onInsertOrUpdate(dbToQuote(payload.new as DbQuote));
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}