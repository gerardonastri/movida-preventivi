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
  source?: 'wix' | 'manual'; // 'wix' = importato da Wix API, 'manual' = creato in app
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
 * Genera il prossimo ID documento in modo atomico tramite RPC Supabase.
 * Il prefisso varia in base al tipo di documento:
 *   - 'preventivo' → PREV-001
 *   - 'contratto'  → CONTR-001
 * Fallback a counter locale se offline.
 */
export async function dbNextQuoteId(
  documentType: 'preventivo' | 'contratto' = 'preventivo'
): Promise<string> {
  const prefix = documentType === 'contratto' ? 'CONTR' : 'PREV';

  const { data, error } = await supabase.rpc('next_quote_number');

  if (error || data == null) {
    console.warn('[db] nextQuoteId fallback to local counter:', error?.message);
    const local = parseInt(localStorage.getItem('preventivi_counter') || '0', 10) + 1;
    localStorage.setItem('preventivi_counter', String(local));
    return `${prefix}-${String(local).padStart(3, '0')}`;
  }

  localStorage.setItem('preventivi_counter', String(data));
  return `${prefix}-${String(data as number).padStart(3, '0')}`;
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
    source:  row.source ?? 'wix',
  }));
}

/**
 * Salva l'intero catalogo sostituendolo.
 * Usato per modifiche manuali dell'utente (CRUD in-app).
 * Preserva il campo `source` di ogni item.
 */
export async function dbSaveCatalog(items: CatalogItem[]): Promise<boolean> {
  if (items.length === 0) {
    const { error } = await supabase
      .from('catalog')
      .delete()
      .gte('sort_order', 0);
    if (error) {
      console.error('[db] saveCatalog delete-all error:', error.message);
      return false;
    }
    return true;
  }

  const seenIds = new Set<string>();
  const rows: DbCatalogItem[] = items.map((item, i) => {
    let id = item.id && item.id.trim() !== '' ? item.id : crypto.randomUUID();
    if (seenIds.has(id)) id = crypto.randomUUID();
    seenIds.add(id);
    return {
      id,
      name:       item.name,
      details:    item.details,
      notes:      item.notes,
      price:      item.price,
      sort_order: i,
      source:     (item as CatalogItem & { source?: string }).source === 'manual' ? 'manual' : 'wix',
    };
  });

  const { error: upsertError } = await supabase
    .from('catalog')
    .upsert(rows, { onConflict: 'id' });

  if (upsertError) {
    console.error('[db] saveCatalog upsert error:', upsertError.message);
    return false;
  }

  // Rimuovi orfani (presenti in DB ma non nel nuovo set)
  const currentIds = rows.map(r => r.id);
  const { error: deleteError } = await supabase
    .from('catalog')
    .delete()
    .not('id', 'in', `(${currentIds.map(id => `"${id}"`).join(',')})`);

  if (deleteError) {
    console.warn('[db] saveCatalog orphan-delete warning:', deleteError.message);
  }

  return true;
}

/**
 * Sincronizza gli item di Wix nel catalogo Supabase senza toccare gli item 'manual'.
 *
 * Strategia:
 * 1. Recupera gli item 'manual' esistenti in Supabase → li preserva
 * 2. Fa upsert degli item Wix con source='wix'
 * 3. Elimina solo gli item Wix che NON sono più presenti nel nuovo set
 *    (non tocca MAI gli item manual)
 *
 * Questo garantisce che i tuoi item creati in-app sopravvivano al sync Wix.
 */
export async function dbSyncWixCatalog(wixItems: CatalogItem[]): Promise<boolean> {
  // 1. Prendi gli ID degli item manual esistenti in Supabase
  const { data: existingManual, error: fetchError } = await supabase
    .from('catalog')
    .select('id, sort_order')
    .eq('source', 'manual');

  if (fetchError) {
    console.error('[db] syncWixCatalog fetch manual error:', fetchError.message);
    // Non blocchiamo — continuiamo con il sync Wix ma senza cancellare nulla
  }

  const manualIds = new Set<string>(
    (existingManual ?? []).map((r: { id: string }) => r.id)
  );

  // Il sort_order degli item Wix parte dopo l'ultimo degli item manual
  const maxManualOrder = existingManual && existingManual.length > 0
    ? Math.max(...(existingManual as { sort_order: number }[]).map(r => r.sort_order))
    : -1;

  // 2. Prepara le righe Wix
  const seenIds = new Set<string>();
  const wixRows: DbCatalogItem[] = wixItems.map((item, i) => {
    let id = item.id && item.id.trim() !== '' ? item.id : crypto.randomUUID();
    if (seenIds.has(id)) id = crypto.randomUUID();
    seenIds.add(id);
    return {
      id,
      name:       item.name,
      details:    item.details,
      notes:      item.notes,
      price:      item.price,
      sort_order: maxManualOrder + 1 + i,
      source:     'wix' as const,
    };
  });

  // 3. Upsert item Wix
  if (wixRows.length > 0) {
    const { error: upsertError } = await supabase
      .from('catalog')
      .upsert(wixRows, { onConflict: 'id' });

    if (upsertError) {
      console.error('[db] syncWixCatalog upsert error:', upsertError.message);
      return false;
    }
  }

  // 4. Elimina solo gli item Wix orfani (non i manual)
  const newWixIds = wixRows.map(r => r.id);
  if (newWixIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('catalog')
      .delete()
      .eq('source', 'wix')
      .not('id', 'in', `(${newWixIds.map(id => `"${id}"`).join(',')})`);

    if (deleteError) {
      console.warn('[db] syncWixCatalog orphan-delete warning:', deleteError.message);
    }
  }

  // Aggiorna i sort_order degli item manual per tenerli in cima
  if (existingManual && existingManual.length > 0) {
    const manualUpdates = (existingManual as { id: string; sort_order: number }[]).map((r, i) => ({
      id: r.id,
      sort_order: i,
    }));
    for (const upd of manualUpdates) {
      await supabase.from('catalog').update({ sort_order: upd.sort_order }).eq('id', upd.id);
    }
  }

  console.log(`[db] syncWixCatalog OK: ${wixRows.length} Wix items, ${manualIds.size} manual preservati`);
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