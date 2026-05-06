/**
 * db.ts — Layer di accesso dati Supabase
 *
 * CATALOG — strategia source:
 * - source='wix'    → item importato dal sito Movida tramite sync API
 * - source='manual' → item creato manualmente in app
 *
 * Regola d'oro: il sync Wix NON tocca MAI gli item source='manual'.
 *
 * Funzioni:
 *   dbGetCatalog()         → legge tutto il catalogo (wix + manual)
 *   dbSaveCatalog()        → salva il catalogo completo (CRUD in-app)
 *   dbSaveManualItem()     → salva/aggiorna UN singolo item manual
 *   dbDeleteCatalogItem()  → elimina un singolo item per id
 *   dbSyncWixCatalog()     → sync Wix → Supabase (preserva sempre i manual)
 */

import { supabase } from './supabase';
import type { Quote, CompanySettings, CatalogItem } from './types';

// ─── Tipi DB ─────────────────────────────────────────────────────────────────

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
  source: 'wix' | 'manual';
}

// ─── Mapping DB → App ────────────────────────────────────────────────────────

function dbToQuote(row: DbQuote): Quote {
  return {
    id:            row.id,
    createdAt:     row.created_at,
    client: {
      name:      row.client_name,
      address:   row.client_address,
      phone:     row.client_phone,
      eventType: row.client_event_type,
      location:  row.client_location,
      date:      row.client_date,
      timeFrom:  row.client_time_from,
      timeTo:    row.client_time_to,
    },
    services:      row.services       ?? [],
    discount:      Number(row.discount) || 0,
    selectedNotes: row.selected_notes  ?? [],
    notes:         row.notes           ?? '',
    status:        row.status,
    documentType:  row.document_type,
    paymentMethod: row.payment_method,
    promoLocale:   row.promo_locale    ?? false,
  };
}

function quoteToDB(q: Quote): Omit<DbQuote, 'updated_at' | 'quote_number'> {
  return {
    id:                q.id,
    created_at:        q.createdAt,
    client_name:       q.client.name,
    client_address:    q.client.address,
    client_phone:      q.client.phone,
    client_event_type: q.client.eventType,
    client_location:   q.client.location,
    client_date:       q.client.date,
    client_time_from:  q.client.timeFrom,
    client_time_to:    q.client.timeTo,
    services:          q.services,
    discount:          q.discount,
    selected_notes:    q.selectedNotes  ?? [],
    notes:             q.notes          ?? '',
    status:            q.status,
    document_type:     q.documentType,
    payment_method:    q.paymentMethod,
    promo_locale:      q.promoLocale    ?? false,
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

export async function dbGetQuotes(): Promise<Quote[]> {
  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) { console.error('[db] getQuotes error:', error.message); return []; }
  return (data as DbQuote[]).map(dbToQuote);
}

export async function dbSaveQuote(quote: Quote): Promise<boolean> {
  const { error } = await supabase
    .from('quotes')
    .upsert(quoteToDB(quote), { onConflict: 'id' });

  if (error) { console.error('[db] saveQuote error:', error.message); return false; }
  return true;
}

export async function dbDeleteQuote(id: string): Promise<boolean> {
  const { error } = await supabase.from('quotes').delete().eq('id', id);
  if (error) { console.error('[db] deleteQuote error:', error.message); return false; }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// QUOTE ID
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera il prossimo ID documento in modo atomico con contatori SEPARATI.
 *
 * - 'preventivo' → usa RPC next_quote_number    (contatore 'main')    → PREV-001
 * - 'contratto'  → usa RPC next_contract_number (contatore 'contracts') → CONTR-001
 *
 * In questo modo i numeri di preventivi e contratti sono indipendenti:
 * PREV-001, PREV-002, CONTR-001, PREV-003, CONTR-002 — mai CONTR-007.
 */
export async function dbNextQuoteId(
  documentType: 'preventivo' | 'contratto' = 'preventivo',
): Promise<string> {
  const isContratto = documentType === 'contratto';
  const prefix      = isContratto ? 'CONTR' : 'PREV';
  const rpcName     = isContratto ? 'next_contract_number' : 'next_quote_number';
  const localKey    = isContratto ? 'preventivi_counter_contracts' : 'preventivi_counter';

  const { data, error } = await supabase.rpc(rpcName);

  if (error || data == null) {
    console.warn(`[db] ${rpcName} fallback to local:`, error?.message);
    const local = parseInt(localStorage.getItem(localKey) || '0', 10) + 1;
    localStorage.setItem(localKey, String(local));
    return `${prefix}-${String(local).padStart(3, '0')}`;
  }

  localStorage.setItem(localKey, String(data));
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

  if (error) { console.error('[db] getSettings error:', error.message); return null; }
  if (!data) return null;
  return dbToSettings(data as DbSettings);
}

export async function dbSaveSettings(settings: CompanySettings): Promise<boolean> {
  const { error } = await supabase
    .from('settings')
    .upsert({ id: 'singleton', ...settingsToDB(settings) }, { onConflict: 'id' });

  if (error) { console.error('[db] saveSettings error:', error.message); return false; }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// CATALOG
// ─────────────────────────────────────────────────────────────────────────────

/** Legge tutto il catalogo da Supabase (wix + manual). */
export async function dbGetCatalog(): Promise<CatalogItem[] | null> {
  const { data, error } = await supabase
    .from('catalog')
    .select('id, name, details, notes, price, sort_order, source')
    .order('sort_order', { ascending: true });

  if (error) { console.error('[db] getCatalog error:', error.message); return null; }
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
 * Salva l'intero set di item (CRUD in-app).
 * Mantiene il source originale di ogni item.
 * Elimina gli orfani (qualunque source) che non sono nel nuovo set.
 */
export async function dbSaveCatalog(items: CatalogItem[]): Promise<boolean> {
  if (items.length === 0) {
    const { error } = await supabase.from('catalog').delete().gte('sort_order', 0);
    if (error) { console.error('[db] saveCatalog delete-all error:', error.message); return false; }
    return true;
  }

  const seenIds = new Set<string>();
  const rows: DbCatalogItem[] = items.map((item, i) => {
    let id = item.id?.trim() || crypto.randomUUID();
    if (seenIds.has(id)) id = crypto.randomUUID();
    seenIds.add(id);
    return {
      id,
      name:       item.name,
      details:    item.details,
      notes:      item.notes,
      price:      item.price,
      sort_order: i,
      // Preserva il source originale; se non c'è, default a 'wix'
      source:     item.source === 'manual' ? 'manual' : 'wix',
    };
  });

  const { error: upsertError } = await supabase
    .from('catalog')
    .upsert(rows, { onConflict: 'id' });

  if (upsertError) {
    console.error('[db] saveCatalog upsert error:', upsertError.message);
    return false;
  }

  const ids = rows.map(r => `"${r.id}"`).join(',');
  const { error: deleteError } = await supabase
    .from('catalog')
    .delete()
    .not('id', 'in', `(${ids})`);

  if (deleteError) console.warn('[db] saveCatalog orphan-delete:', deleteError.message);
  return true;
}

/**
 * Salva/aggiorna UN singolo item con source='manual'.
 * Chiamata quando l'utente crea un nuovo item o lo modifica —
 * garantisce che source sia sempre 'manual' indipendentemente da cosa
 * c'era prima.
 */
export async function dbSaveManualItem(item: CatalogItem, sortOrder: number): Promise<boolean> {
  const row: DbCatalogItem = {
    id:         item.id,
    name:       item.name,
    details:    item.details,
    notes:      item.notes,
    price:      item.price,
    sort_order: sortOrder,
    source:     'manual',
  };

  const { error } = await supabase
    .from('catalog')
    .upsert(row, { onConflict: 'id' });

  if (error) { console.error('[db] saveManualItem error:', error.message); return false; }
  return true;
}

/**
 * Elimina un singolo item dal catalogo Supabase.
 */
export async function dbDeleteCatalogItem(id: string): Promise<boolean> {
  const { error } = await supabase.from('catalog').delete().eq('id', id);
  if (error) { console.error('[db] deleteCatalogItem error:', error.message); return false; }
  return true;
}

/**
 * Sincronizza gli item Wix in Supabase senza MAI toccare source='manual'.
 *
 * Algoritmo:
 * 1. Conta i manual esistenti → li usa come offset per sort_order Wix
 * 2. Upsert degli item Wix
 * 3. Elimina SOLO i Wix orfani (source='wix' AND id non nel nuovo set)
 * 4. Gli item source='manual' non vengono mai letti né modificati
 */
export async function dbSyncWixCatalog(wixItems: CatalogItem[]): Promise<boolean> {
  if (wixItems.length === 0) return true;

  // 1. Conta i manual per il sort_order offset
  const { count: manualCount, error: countError } = await supabase
    .from('catalog')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'manual');

  if (countError) console.warn('[db] syncWix count manual error:', countError.message);
  const manualOffset = manualCount ?? 0;

  // 2. Prepara righe Wix
  const seenIds = new Set<string>();
  const wixRows: DbCatalogItem[] = wixItems.map((item, i) => {
    let id = item.id?.trim() || crypto.randomUUID();
    if (seenIds.has(id)) id = crypto.randomUUID();
    seenIds.add(id);
    return {
      id,
      name:       item.name,
      details:    item.details,
      notes:      item.notes,
      price:      item.price,
      sort_order: manualOffset + i,
      source:     'wix' as const,
    };
  });

  // 3. Upsert Wix
  const { error: upsertError } = await supabase
    .from('catalog')
    .upsert(wixRows, { onConflict: 'id' });

  if (upsertError) {
    console.error('[db] syncWixCatalog upsert error:', upsertError.message);
    return false;
  }

  // 4. Elimina SOLO i Wix orfani — MAI i manual
  const newWixIds = wixRows.map(r => `"${r.id}"`).join(',');
  const { error: deleteError } = await supabase
    .from('catalog')
    .delete()
    .eq('source', 'wix')
    .not('id', 'in', `(${newWixIds})`);

  if (deleteError) console.warn('[db] syncWixCatalog orphan-delete warning:', deleteError.message);

  console.log(`[db] syncWixCatalog OK — ${wixRows.length} Wix, ${manualOffset} manual preservati`);
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

  if (error) { console.warn('[db] getLocations error:', error.message); return []; }
  return (data as { location: string }[]).map(r => r.location);
}

export async function dbSaveLocation(location: string): Promise<void> {
  await supabase
    .from('saved_locations')
    .upsert(
      { location: location.trim().toUpperCase(), used_at: new Date().toISOString() },
      { onConflict: 'location' },
    );
}

export async function dbDeleteLocation(location: string): Promise<void> {
  await supabase.from('saved_locations').delete().eq('location', location);
}

// ─────────────────────────────────────────────────────────────────────────────
// FOOTER NOTES — note a piè di pagina salvate nel DB
// ─────────────────────────────────────────────────────────────────────────────

export interface FooterNote {
  id: string;
  content: string;
  sortOrder: number;
}

interface DbFooterNote {
  id: string;
  content: string;
  sort_order: number;
}

export async function dbGetFooterNotes(): Promise<FooterNote[]> {
  const { data, error } = await supabase
    .from('footer_notes')
    .select('id, content, sort_order')
    .order('sort_order', { ascending: true });

  if (error) { console.error('[db] getFooterNotes error:', error.message); return []; }
  return (data as DbFooterNote[]).map(r => ({
    id:        r.id,
    content:   r.content,
    sortOrder: r.sort_order,
  }));
}

export async function dbSaveFooterNote(note: FooterNote): Promise<boolean> {
  const { error } = await supabase
    .from('footer_notes')
    .upsert(
      { id: note.id, content: note.content, sort_order: note.sortOrder },
      { onConflict: 'id' },
    );
  if (error) { console.error('[db] saveFooterNote error:', error.message); return false; }
  return true;
}

export async function dbDeleteFooterNote(id: string): Promise<boolean> {
  const { error } = await supabase.from('footer_notes').delete().eq('id', id);
  if (error) { console.error('[db] deleteFooterNote error:', error.message); return false; }
  return true;
}

/** Riscrive l'intero set di note in un'unica operazione atomica. */
export async function dbSaveAllFooterNotes(notes: FooterNote[]): Promise<boolean> {
  // Upsert di tutte le note correnti
  if (notes.length > 0) {
    const rows: DbFooterNote[] = notes.map((n, i) => ({
      id:         n.id,
      content:    n.content,
      sort_order: i,
    }));
    const { error: upsertErr } = await supabase
      .from('footer_notes')
      .upsert(rows, { onConflict: 'id' });
    if (upsertErr) { console.error('[db] saveAllFooterNotes upsert error:', upsertErr.message); return false; }
  }

  // Elimina le note orfane (quelle che non sono nel nuovo set)
  if (notes.length > 0) {
    const ids = notes.map(n => `"${n.id}"`).join(',');
    await supabase.from('footer_notes').delete().not('id', 'in', `(${ids})`);
  } else {
    // Se la lista è vuota, cancella tutto
    await supabase.from('footer_notes').delete().gte('sort_order', 0);
  }

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// REALTIME
// ─────────────────────────────────────────────────────────────────────────────

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
      },
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}