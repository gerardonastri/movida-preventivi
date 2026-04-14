/**
 * useAppData.ts — Hook centrale per la gestione dati dell'app
 *
 * Responsabilità:
 * 1. Carica i dati da localStorage istantaneamente (nessun flash)
 * 2. Al mount, sincronizza con Supabase in background
 * 3. Mantiene un canale Realtime per aggiornamenti multi-device
 * 4. Espone saveQuote/deleteQuote che aggiornano sia lo stato locale sia Supabase
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Quote, CompanySettings, CatalogItem } from './types';
import {
  getQuotes,
  saveQuote as localSaveQuote,
  deleteQuote as localDeleteQuote,
  getSettings,
  saveSettings as localSaveSettings,
  getCatalogItems,
  syncFromSupabase,
} from './storage';
import { subscribeToQuotes, dbNextQuoteId } from './db';

export type SyncState = 'idle' | 'syncing' | 'ok' | 'error';

export interface AppData {
  quotes:    Quote[];
  settings:  CompanySettings;
  catalog:   CatalogItem[];
  syncState: SyncState;
  lastSync:  Date | null;

  // Azioni
  saveQuote:    (q: Quote) => void;
  deleteQuote:  (id: string) => void;
  saveSettings: (s: CompanySettings) => void;
  setQuotes:    (qs: Quote[]) => void;   // per Dashboard status change
  getNextId:    () => Promise<string>;
}

export function useAppData(): AppData {
  // ── Stato iniziale da localStorage (sincrono, nessun loading state) ─────
  const [quotes,    setQuotesState]    = useState<Quote[]>(() => getQuotes());
  const [settings,  setSettingsState]  = useState<CompanySettings>(() => getSettings());
  const [catalog]                      = useState<CatalogItem[]>(() => getCatalogItems());
  const [syncState, setSyncState]      = useState<SyncState>('idle');
  const [lastSync,  setLastSync]       = useState<Date | null>(null);

  // Ref per evitare loop nel realtime
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // ── Sync iniziale da Supabase ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const doSync = async () => {
      setSyncState('syncing');
      try {
        const result = await syncFromSupabase();
        if (cancelled || !isMounted.current) return;

        setQuotesState(result.quotes);
        setSettingsState(result.settings);
        setSyncState('ok');
        setLastSync(new Date());
      } catch (err) {
        console.error('[useAppData] sync error:', err);
        if (!cancelled && isMounted.current) {
          setSyncState('error');
        }
      }
    };

    doSync();
    return () => { cancelled = true; };
  }, []);

  // ── Realtime subscription ────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = subscribeToQuotes(
      (updatedQuote) => {
        if (!isMounted.current) return;
        setQuotesState(prev => {
          const idx = prev.findIndex(q => q.id === updatedQuote.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = updatedQuote;
            return next;
          }
          return [updatedQuote, ...prev];
        });
      },
      (deletedId) => {
        if (!isMounted.current) return;
        setQuotesState(prev => prev.filter(q => q.id !== deletedId));
      }
    );

    return unsubscribe;
  }, []);

  // ── Azioni ────────────────────────────────────────────────────────────

  const saveQuote = useCallback((quote: Quote) => {
    // Aggiorna stato React immediatamente
    setQuotesState(prev => {
      const idx = prev.findIndex(q => q.id === quote.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = quote;
        return next;
      }
      return [quote, ...prev];
    });
    // Persiste (localStorage + Supabase)
    localSaveQuote(quote);
  }, []);

  const deleteQuote = useCallback((id: string) => {
    setQuotesState(prev => prev.filter(q => q.id !== id));
    localDeleteQuote(id);
  }, []);

  const saveSettings = useCallback((s: CompanySettings) => {
    setSettingsState(s);
    localSaveSettings(s);
  }, []);

  const setQuotes = useCallback((qs: Quote[]) => {
    setQuotesState(qs);
    // Persiste ogni quote modificata
    qs.forEach(q => localSaveQuote(q));
  }, []);

  const getNextId = useCallback(() => dbNextQuoteId(), []);

  return {
    quotes,
    settings,
    catalog,
    syncState,
    lastSync,
    saveQuote,
    deleteQuote,
    saveSettings,
    setQuotes,
    getNextId,
  };
}