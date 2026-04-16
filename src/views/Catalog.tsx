/**
 * Catalog.tsx
 *
 * Gestione catalogo con due origini:
 *  - item 'wix'    → importati dal sito Movida via API
 *  - item 'manual' → creati in-app (badge verde "Personale")
 *
 * Regola chiave: il sync Wix NON tocca mai gli item 'manual'.
 */

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getCatalogItems,
  fetchCatalogFromApi,
  getCatalogLastSync,
  isCatalogCacheStale,
} from '../utils/storage';
import {
  dbGetCatalog,
  dbSaveCatalog,
  dbSaveManualItem,
  dbDeleteCatalogItem,
  dbSyncWixCatalog,
} from '../utils/db';
import type { CatalogItem } from '../utils/types';

type SyncStatus = 'idle' | 'loading' | 'success' | 'error';

function extractTag(name: string): string {
  const m = name.match(/^\[(.*?)\]/);
  return m ? m[1].toUpperCase() : 'ALTRO';
}

export default function Catalog() {
  const [items,       setItems]       = useState<CatalogItem[]>(getCatalogItems());
  const [searchTerm,  setSearchTerm]  = useState('');
  const [activeTab,   setActiveTab]   = useState<string>('TUTTI');
  const [syncStatus,  setSyncStatus]  = useState<SyncStatus>('idle');
  const [syncMessage, setSyncMessage] = useState<string>('');
  const [lastSync,    setLastSync]    = useState<Date | null>(getCatalogLastSync());
  const [isStale,     setIsStale]     = useState<boolean>(isCatalogCacheStale());

  const supabaseSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPendingSave    = useRef(false);

  // ── Carica da Supabase al mount ──────────────────────────────────────────
  useEffect(() => {
    dbGetCatalog()
      .then(remoteItems => {
        if (remoteItems && remoteItems.length > 0) {
          setItems(remoteItems);
          localStorage.setItem('preventivi_catalog', JSON.stringify(remoteItems));
        } else if (isCatalogCacheStale()) {
          syncFromApi(false);
        }
      })
      .catch(() => { if (isCatalogCacheStale()) syncFromApi(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Flush pendente al dismount ───────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (supabaseSaveTimer.current && hasPendingSave.current) {
        clearTimeout(supabaseSaveTimer.current);
        dbSaveCatalog(items).catch(console.error);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // ── Sync Wix → Supabase (preserva i manual) ─────────────────────────────
  const syncFromApi = useCallback(async (force = false) => {
    setSyncStatus('loading');
    setSyncMessage('Sincronizzazione da Wix…');

    try {
      const result = await fetchCatalogFromApi(force);

      if (result.source === 'api') {
        // Usa dbSyncWixCatalog — NON tocca i manual
        await dbSyncWixCatalog(result.items);

        // Rileggi il catalogo completo da Supabase (wix + manual merged)
        const merged = await dbGetCatalog();
        const finalItems = merged ?? result.items;

        setItems(finalItems);
        localStorage.setItem('preventivi_catalog', JSON.stringify(finalItems));
        setLastSync(result.updatedAt);
        setIsStale(false);
        setSyncStatus('success');
        const manualCount = finalItems.filter(i => i.source === 'manual').length;
        setSyncMessage(
          `Sincronizzato! ${result.items.length} da Wix` +
          (manualCount > 0 ? `, ${manualCount} tuoi preservati.` : '.'),
        );

      } else if (result.source === 'cache') {
        setLastSync(result.updatedAt);
        setIsStale(false);
        setSyncStatus('idle');
        setSyncMessage('');

      } else {
        // Fallback locale — NON sovrascrivere Supabase
        setSyncStatus('error');
        setSyncMessage('Wix irraggiungibile. Dati locali mantenuti.');
      }
    } catch {
      setSyncStatus('error');
      setSyncMessage('Errore di rete. Riprova.');
    }

    setTimeout(() => { setSyncStatus('idle'); setSyncMessage(''); }, 4000);
  }, []);

  // ── CRUD ─────────────────────────────────────────────────────────────────

  /** Aggiorna stato locale + debounce save Supabase (per modifiche in-place). */
  const updateItems = useCallback((newItems: CatalogItem[]) => {
    setItems(newItems);
    localStorage.setItem('preventivi_catalog', JSON.stringify(newItems));
    hasPendingSave.current = true;

    if (supabaseSaveTimer.current) clearTimeout(supabaseSaveTimer.current);
    supabaseSaveTimer.current = setTimeout(() => {
      hasPendingSave.current = false;
      dbSaveCatalog(newItems).catch(err =>
        console.error('[Catalog] dbSaveCatalog error:', err),
      );
    }, 1200);
  }, []);

  const handleAddItem = () => {
    const newItem: CatalogItem = {
      id:      crypto.randomUUID(),
      name:    '[NUOVO] Nome Servizio',
      details: '',
      notes:   '',
      price:   0,
      source:  'manual',
    };
    const newItems = [newItem, ...items];
    setItems(newItems);
    localStorage.setItem('preventivi_catalog', JSON.stringify(newItems));

    // Salva subito come 'manual' su Supabase, senza aspettare il debounce
    dbSaveManualItem(newItem, 0).catch(err =>
      console.error('[Catalog] dbSaveManualItem error:', err),
    );
    setActiveTab('TUTTI');
  };

  const handleChange = (id: string, field: keyof CatalogItem, value: string | number) => {
    updateItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleDelete = (id: string) => {
    if (!confirm('Vuoi eliminare questo servizio dal catalogo?')) return;
    setItems(prev => prev.filter(item => item.id !== id));
    localStorage.setItem(
      'preventivi_catalog',
      JSON.stringify(items.filter(item => item.id !== id)),
    );
    // Elimina subito su Supabase (atomico, non aspetta debounce)
    dbDeleteCatalogItem(id).catch(err =>
      console.error('[Catalog] dbDeleteCatalogItem error:', err),
    );
  };

  const handleFactoryReset = async () => {
    if (!confirm('Attenzione: questo cancellerà TUTTO il catalogo (inclusi i tuoi item personali) e ricaricherà dal sito Movida. Sei sicuro?')) return;
    try { await dbSaveCatalog([]); } catch (err) { console.warn('[Catalog] factory reset:', err); }
    localStorage.removeItem('preventivi_catalog');
    localStorage.removeItem('preventivi_catalog_api');
    localStorage.removeItem('preventivi_catalog_api_timestamp');
    window.location.reload();
  };

  const handleForceSave = async () => {
    setSyncStatus('loading');
    setSyncMessage('Salvataggio su Supabase…');
    if (supabaseSaveTimer.current) {
      clearTimeout(supabaseSaveTimer.current);
      hasPendingSave.current = false;
    }
    try {
      const ok = await dbSaveCatalog(items);
      setSyncStatus(ok ? 'success' : 'error');
      setSyncMessage(ok ? `${items.length} servizi salvati!` : 'Errore salvataggio.');
    } catch {
      setSyncStatus('error');
      setSyncMessage('Errore connessione.');
    }
    setTimeout(() => { setSyncStatus('idle'); setSyncMessage(''); }, 3500);
  };

  // ── Filters ──────────────────────────────────────────────────────────────

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    items.forEach(item => tags.add(extractTag(item.name)));
    return Array.from(tags).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return items.filter(item => {
      if (q) {
        const haystack =
          item.name.toLowerCase() + ' ' +
          item.details.toLowerCase() + ' ' +
          item.notes.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (activeTab !== 'TUTTI' && extractTag(item.name) !== activeTab) return false;
      return true;
    });
  }, [items, searchTerm, activeTab]);

  const formatSyncDate = (date: Date | null): string => {
    if (!date) return 'Mai sincronizzato';
    const diff    = Date.now() - date.getTime();
    const hours   = Math.floor(diff / 3_600_000);
    const minutes = Math.floor((diff % 3_600_000) / 60_000);
    if (hours > 0)   return `${hours}h fa`;
    if (minutes > 0) return `${minutes}m fa`;
    return 'Adesso';
  };

  const inputClass =
    'w-full bg-transparent text-[var(--text-primary)] rounded-lg px-3 py-2 outline-none ' +
    'transition hover:bg-[var(--bg-tertiary)] focus:bg-white focus:ring-2 focus:ring-[var(--accent)]';

  const manualCount = items.filter(i => i.source === 'manual').length;
  const wixCount    = items.length - manualCount;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="pb-24">

      {/* ── Header sticky ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-[var(--bg-primary)]/80 backdrop-blur-lg pt-4 pb-4 -mx-4 px-4 md:mx-0 md:px-0 border-b border-[var(--border)] mb-6">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
              Catalogo Servizi
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">
              <span className="font-semibold text-emerald-600">{manualCount} personali</span>
              {' · '}
              <span>{wixCount} da Wix</span>
              {' · '}
              <span className="font-medium">{items.length} totali</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2 md:gap-2.5 items-center">

            {/* Ricerca */}
            <div className="relative flex-1 md:flex-none md:w-52">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              <input
                type="text"
                placeholder="Cerca servizio…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-[var(--border)] rounded-xl pl-9 pr-8 py-2.5 text-sm shadow-sm outline-none focus:border-[var(--accent)] transition"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition"
                  title="Cancella ricerca"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>

            {/* Sync Wix */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => syncFromApi(true)}
              disabled={syncStatus === 'loading'}
              title="Scarica dal sito Movida (i tuoi item personali sono al sicuro)"
              className={`relative px-3 py-2.5 rounded-xl text-sm font-semibold transition flex items-center gap-2 border
                ${syncStatus === 'loading' ? 'bg-blue-50 border-blue-200 text-blue-400 cursor-wait'
                : syncStatus === 'success' ? 'bg-green-50 border-green-200 text-green-600'
                : syncStatus === 'error'   ? 'bg-red-50 border-red-200 text-red-500'
                : isStale                  ? 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100'
                : 'bg-[var(--bg-tertiary)] border-[var(--border)] text-[var(--text-secondary)] hover:bg-gray-200'}`}
            >
              <span className={syncStatus === 'loading' ? 'animate-spin inline-block' : ''}>
                {syncStatus === 'loading' ? '⏳'
                : syncStatus === 'success' ? '✅'
                : syncStatus === 'error'   ? '❌'
                : '🔄'}
              </span>
              <span className="hidden md:inline whitespace-nowrap">
                {syncStatus === 'loading' ? 'Sincronizzo…'
                : syncStatus === 'success' ? 'Aggiornato!'
                : syncStatus === 'error'   ? 'Errore'
                : isStale                  ? 'Aggiorna da Wix'
                : 'Da Wix'}
              </span>
              {isStale && syncStatus === 'idle' && (
                <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-amber-400 rounded-full border-2 border-white" />
              )}
            </motion.button>

            {/* Salva manualmente su Supabase */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleForceSave}
              disabled={syncStatus === 'loading'}
              title="Salva tutto su Supabase ora"
              className="px-3 py-2.5 bg-[var(--bg-tertiary)] hover:bg-gray-200 text-[var(--text-secondary)] rounded-xl text-sm font-semibold transition border border-[var(--border)]"
            >
              ☁️
            </motion.button>

            {/* Reset factory */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleFactoryReset}
              title="Cancella tutto e ricarica da Wix"
              className="px-3 py-2.5 bg-[var(--bg-tertiary)] hover:bg-red-50 hover:text-red-500 text-[var(--text-secondary)] rounded-xl text-sm font-semibold transition border border-[var(--border)]"
            >
              🗑️
            </motion.button>

            {/* + Nuovo item manual */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleAddItem}
              className="bg-[var(--accent)] text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-[0_4px_14px_rgba(37,99,235,0.25)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.3)] transition whitespace-nowrap"
            >
              + Nuovo
            </motion.button>
          </div>
        </header>

        {/* Feedback sync */}
        <div className="flex items-center justify-between mb-3">
          <AnimatePresence>
            {syncMessage && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`text-xs font-medium px-3 py-1 rounded-full ${
                  syncStatus === 'error'   ? 'bg-red-50 text-red-500'
                  : syncStatus === 'success' ? 'bg-green-50 text-green-600'
                  : 'bg-blue-50 text-blue-500'
                }`}
              >
                {syncMessage}
              </motion.p>
            )}
          </AnimatePresence>
          <p className="text-[11px] text-[var(--text-muted)] font-medium ml-auto">
            🕐 {formatSyncDate(lastSync)}
          </p>
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide snap-x">
          {['TUTTI', ...availableTags].map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTab(tag)}
              className={`snap-start whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                activeTab === tag
                  ? tag === 'TUTTI'
                    ? 'bg-gray-900 text-white shadow-md'
                    : 'bg-[var(--accent)] text-white shadow-[0_2px_10px_rgba(37,99,235,0.2)]'
                  : 'bg-white text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              {tag}
              {tag === 'TUTTI' && (
                <span className="ml-1.5 opacity-50 font-normal">{items.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Griglia ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
        <AnimatePresence>
          {filteredItems.map((item, index) => {
            const isManual = item.source === 'manual';

            return (
              <motion.div
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0, transition: { delay: Math.min(index * 0.04, 0.25) } }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={item.id}
                className={`bg-white p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden border ${
                  isManual
                    ? 'border-emerald-200 ring-1 ring-emerald-100'
                    : 'border-[var(--border)]'
                }`}
              >
                {/* Badge item personale */}
                {isManual && (
                  <div className="absolute top-3 left-3 z-10 pointer-events-none">
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full tracking-wide">
                      ✏️ Personale
                    </span>
                  </div>
                )}

                <div className={`flex flex-col gap-3 ${isManual ? 'mt-5' : ''}`}>
                  {/* Nome + Prezzo */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="[TAG] Nome Servizio"
                        value={item.name}
                        onChange={(e) => handleChange(item.id, 'name', e.target.value)}
                        className={`${inputClass} font-extrabold text-[15px] uppercase placeholder-gray-300 py-1.5`}
                      />
                    </div>
                    <div className="w-28 relative flex-shrink-0">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-medium">€</span>
                      <input
                        type="number"
                        value={item.price}
                        onChange={(e) => handleChange(item.id, 'price', Number(e.target.value))}
                        className={`${inputClass} pl-8 font-black text-right text-base text-[var(--accent)] bg-blue-50/50`}
                      />
                    </div>
                  </div>

                  {/* Dettagli + Note */}
                  <div className="space-y-1">
                    <textarea
                      placeholder="Dettagli servizio (testo grigio in PDF)…"
                      value={item.details}
                      onChange={(e) => handleChange(item.id, 'details', e.target.value)}
                      rows={2}
                      className={`${inputClass} resize-none text-xs font-medium text-gray-600 leading-relaxed`}
                    />
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 w-1.5 h-1.5 rounded-full bg-blue-400" />
                      <textarea
                        placeholder="Note operative (testo azzurro in PDF)…"
                        value={item.notes}
                        onChange={(e) => handleChange(item.id, 'notes', e.target.value)}
                        rows={1}
                        className={`${inputClass} pl-7 resize-none text-[11px] font-semibold text-blue-600/80 leading-snug`}
                      />
                    </div>
                  </div>
                </div>

                {/* Elimina */}
                <button
                  onClick={() => handleDelete(item.id)}
                  className="absolute top-4 right-4 md:opacity-0 md:group-hover:opacity-100 p-2 bg-white/80 backdrop-blur-sm text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all shadow-sm border border-transparent hover:border-red-100"
                  title="Elimina"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18"/>
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                  </svg>
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filteredItems.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="col-span-full flex flex-col items-center justify-center py-16 text-center bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-3xl mt-4"
          >
            <span className="text-4xl mb-3">
              {syncStatus === 'loading' ? '⏳' : searchTerm ? '🔍' : '👻'}
            </span>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">
              {syncStatus === 'loading'
                ? 'Sincronizzazione in corso…'
                : searchTerm
                  ? `Nessun risultato per "${searchTerm}"`
                  : 'Nessun servizio trovato'}
            </h3>
            <p className="text-sm text-[var(--text-muted)] mt-1 max-w-sm">
              {syncStatus === 'loading'
                ? 'Attendere prego.'
                : searchTerm
                  ? 'Prova con un altro termine.'
                  : activeTab !== 'TUTTI'
                    ? `Nessun servizio nella categoria ${activeTab}.`
                    : 'Clicca "+ Nuovo" o usa 🔄 per scaricare dal sito.'}
            </p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="mt-4 text-[var(--accent)] text-sm font-medium hover:underline"
              >
                Cancella ricerca
              </button>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}