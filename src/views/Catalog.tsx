import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getCatalogItems,
  saveCatalogItems,
  fetchCatalogFromApi,
  getCatalogLastSync,
  isCatalogCacheStale,
} from '../utils/storage';
import { dbGetCatalog, dbSaveCatalog } from '../utils/db';
import type { CatalogItem } from '../utils/types';

type SyncStatus = 'idle' | 'loading' | 'success' | 'error';

export default function Catalog() {
  const [items, setItems] = useState<CatalogItem[]>(getCatalogItems());
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<string>('TUTTI');

  const [syncStatus, setSyncStatus]   = useState<SyncStatus>('idle');
  const [syncMessage, setSyncMessage] = useState<string>('');
  const [lastSync, setLastSync]       = useState<Date | null>(getCatalogLastSync());
  const [isStale, setIsStale]         = useState<boolean>(isCatalogCacheStale());

  const supabaseSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Carica da Supabase al mount ────────
  useEffect(() => {
    dbGetCatalog().then(remoteItems => {
      if (remoteItems && remoteItems.length > 0) {
        setItems(remoteItems);
        localStorage.setItem('preventivi_catalog', JSON.stringify(remoteItems));
      } else if (isCatalogCacheStale()) {
        syncFromApi(false);
      }
    }).catch(() => {
      if (isCatalogCacheStale()) syncFromApi(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync API Wix (FIXED: Difesa dei dati Supabase) ────────
  const syncFromApi = useCallback(async (force = false) => {
    setSyncStatus('loading');
    setSyncMessage('Sincronizzazione in corso…');

    const result = await fetchCatalogFromApi(force);

    if (result.source === 'api') {
      // Successo API Reale: scaricato nuovo JSON dal sito Wix
      setItems(result.items);
      setLastSync(result.updatedAt);
      setIsStale(false);
      setSyncStatus('success');
      setSyncMessage(`Catalogo aggiornato! (${result.items.length} servizi)`);
      
      dbSaveCatalog(result.items).catch(err =>
        console.warn('[Catalog] Wix→Supabase sync warn:', err)
      );
    } else if (result.source === 'cache') {
      // Successo Cache: usiamo la cache fresca locale del sito Wix
      setItems(result.items);
      setLastSync(result.updatedAt);
      setIsStale(false);
      setSyncStatus('idle');
      setSyncMessage('');
    } else {
      // ERRORE CRITICO: Il sito Wix non è raggiungibile.
      // FIX APPLE: NON facciamo "setItems(result.items)", altrimenti 
      // distruggiamo i dati attuali di Supabase con il defaultCatalog locale!
      setSyncStatus('error');
      setSyncMessage('Sito irraggiungibile. Dati Database mantenuti intatti.');
    }

    setTimeout(() => { setSyncStatus('idle'); setSyncMessage(''); }, 4500);
  }, []);

  // ── CRUD con debounce Supabase ─────────────────────────────────────────────

  const updateItems = useCallback((newItems: CatalogItem[]) => {
    setItems(newItems);
    localStorage.setItem('preventivi_catalog', JSON.stringify(newItems));

    if (supabaseSaveTimer.current) clearTimeout(supabaseSaveTimer.current);
    supabaseSaveTimer.current = setTimeout(() => {
      dbSaveCatalog(newItems).catch(err =>
        console.error('[Catalog] dbSaveCatalog error:', err)
      );
    }, 1500);
  }, []);

  useEffect(() => {
    return () => {
      if (supabaseSaveTimer.current) {
        clearTimeout(supabaseSaveTimer.current);
        const pending = items;
        dbSaveCatalog(pending).catch(() => {/* silent */});
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const handleAddItem = () => {
    const newItem: CatalogItem = {
      id: crypto.randomUUID(),
      name: '[NUOVO] Nome Servizio',
      details: '',
      notes: '',
      price: 0,
    };
    updateItems([newItem, ...items]);
    setActiveTab('TUTTI');
  };

  const handleChange = (id: string, field: keyof CatalogItem, value: string | number) => {
    updateItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleDelete = (id: string) => {
    if (!confirm('Vuoi eliminare questo servizio dal catalogo?')) return;
    updateItems(items.filter(item => item.id !== id));
  };

  const handleFactoryReset = async () => {
    if (!confirm('Attenzione: Questo cancellerà tutte le tue modifiche locali e su Supabase, e ricaricherà il catalogo dal sito Movida. Vuoi procedere?')) return;
    try {
      await dbSaveCatalog([]);
    } catch (err) {
      console.warn('[Catalog] factory reset Supabase clear:', err);
    }
    localStorage.removeItem('preventivi_catalog');
    localStorage.removeItem('preventivi_catalog_api');
    localStorage.removeItem('preventivi_catalog_api_timestamp');
    window.location.reload();
  };

  const handleForceSave = async () => {
    setSyncStatus('loading');
    setSyncMessage('Salvataggio su Supabase…');
    try {
      if (supabaseSaveTimer.current) clearTimeout(supabaseSaveTimer.current);
      const ok = await dbSaveCatalog(items);
      saveCatalogItems(items); 
      if (ok) {
        setSyncStatus('success');
        setSyncMessage(`${items.length} servizi salvati su Supabase!`);
      } else {
        setSyncStatus('error');
        setSyncMessage('Errore salvataggio Supabase.');
      }
    } catch {
      setSyncStatus('error');
      setSyncMessage('Errore connessione.');
    }
    setTimeout(() => { setSyncStatus('idle'); setSyncMessage(''); }, 3500);
  };

  // ── Smart Filters ──────────────────────────────────────────────────────────

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    items.forEach(item => {
      const match = item.name.match(/^\[(.*?)\]/);
      tags.add(match ? match[1].toUpperCase() : 'ALTRO');
    });
    return Array.from(tags).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchText =
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.details.toLowerCase().includes(searchTerm.toLowerCase());
      const match    = item.name.match(/^\[(.*?)\]/);
      const itemTag  = match ? match[1].toUpperCase() : 'ALTRO';
      const matchTab = activeTab === 'TUTTI' || itemTag === activeTab;
      return matchText && matchTab;
    });
  }, [items, searchTerm, activeTab]);

  const inputClass =
    "w-full bg-transparent text-[var(--text-primary)] rounded-lg px-3 py-2 outline-none transition hover:bg-[var(--bg-tertiary)] focus:bg-white focus:ring-2 focus:ring-[var(--accent)]";

  const formatSyncDate = (date: Date | null): string => {
    if (!date) return 'Mai sincronizzato';
    const diff    = Date.now() - date.getTime();
    const hours   = Math.floor(diff / 3_600_000);
    const minutes = Math.floor((diff % 3_600_000) / 60_000);
    if (hours > 0)   return `${hours}h fa`;
    if (minutes > 0) return `${minutes}m fa`;
    return 'Adesso';
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="pb-24">
      {/* Header Sticky */}
      <div className="sticky top-0 z-20 bg-[var(--bg-primary)]/80 backdrop-blur-lg pt-4 pb-4 -mx-4 px-4 md:mx-0 md:px-0 border-b border-[var(--border)] mb-6">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Catalogo Servizi</h1>
            <p className="text-sm text-[var(--text-muted)] mt-0.5 font-medium">
              I tuoi pacchetti per preventivi lampo. · {items.length} servizi
            </p>
          </div>

          <div className="flex flex-wrap gap-2 md:gap-2.5 items-center">
            {/* Ricerca */}
            <div className="relative flex-1 md:flex-none md:w-48">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              <input
                type="text"
                placeholder="Cerca…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-[var(--border)] rounded-xl pl-9 pr-4 py-2.5 text-sm shadow-sm outline-none focus:border-[var(--accent)] transition"
              />
            </div>

            {/* Sync API Wix */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => syncFromApi(true)}
              disabled={syncStatus === 'loading'}
              title="Scarica catalogo dal sito Movida"
              className={`relative px-3 py-2.5 rounded-xl text-sm font-semibold transition flex items-center gap-2 border
                ${syncStatus === 'loading'  ? 'bg-blue-50 border-blue-200 text-blue-400 cursor-wait'
                : syncStatus === 'success'  ? 'bg-green-50 border-green-200 text-green-600'
                : syncStatus === 'error'    ? 'bg-red-50 border-red-200 text-red-500'
                : isStale                   ? 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100'
                : 'bg-[var(--bg-tertiary)] border-[var(--border)] text-[var(--text-secondary)] hover:bg-gray-200'}`}
            >
              <span className={syncStatus === 'loading' ? 'animate-spin inline-block' : ''}>
                {syncStatus === 'loading' ? '⏳' : syncStatus === 'success' ? '✅' : syncStatus === 'error' ? '❌' : '🔄'}
              </span>
              <span className="hidden md:inline">
                {syncStatus === 'loading' ? 'Aggiorno…'
                : syncStatus === 'success' ? 'Aggiornato!'
                : syncStatus === 'error'   ? 'Errore API'
                : isStale ? 'Aggiorna da Wix'
                : 'Da Wix'}
              </span>
              {isStale && syncStatus === 'idle' && (
                <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-amber-400 rounded-full border-2 border-white" />
              )}
            </motion.button>

            {/* Salva su Supabase */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleForceSave}
              disabled={syncStatus === 'loading'}
              title="Salva catalogo su Supabase ora"
              className="px-3 py-2.5 bg-[var(--bg-tertiary)] hover:bg-gray-200 text-[var(--text-secondary)] rounded-xl text-sm font-semibold transition border border-[var(--border)]"
            >
              ☁️
            </motion.button>

            {/* Reset Factory */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleFactoryReset}
              className="px-3 py-2.5 bg-[var(--bg-tertiary)] hover:bg-red-50 hover:text-red-500 text-[var(--text-secondary)] rounded-xl text-sm font-semibold transition border border-[var(--border)]"
              title="Reset catalogo (locale + Supabase)"
            >
              🗑️
            </motion.button>

            {/* Nuovo item */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleAddItem}
              className="bg-[var(--accent)] text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-[0_4px_14px_rgba(37,99,235,0.25)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.3)] transition whitespace-nowrap"
            >
              + Nuovo
            </motion.button>
          </div>
        </header>

        {/* Riga feedback sync */}
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
                  : 'bg-blue-50 text-blue-500'}`}
              >
                {syncMessage}
              </motion.p>
            )}
          </AnimatePresence>
          <p className="text-[11px] text-[var(--text-muted)] font-medium ml-auto">
            🕐 Aggiornato: {formatSyncDate(lastSync)}
          </p>
        </div>

        {/* Smart Filter Pills */}
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
            </button>
          ))}
        </div>
      </div>

      {/* Griglia Catalogo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
        <AnimatePresence>
          {filteredItems.map((item, index) => (
            <motion.div
              layout
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0, transition: { delay: Math.min(index * 0.04, 0.3) } }}
              exit={{ opacity: 0, scale: 0.95 }}
              key={item.id}
              className="bg-white p-5 rounded-2xl shadow-sm border border-[var(--border)] hover:shadow-md transition-shadow group relative overflow-hidden"
            >
              <div className="flex flex-col gap-3">
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
                <div className="space-y-1 relative">
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

              {/* Pulsante elimina */}
              <button
                onClick={() => handleDelete(item.id)}
                className="absolute top-4 right-4 md:opacity-0 md:group-hover:opacity-100 p-2 bg-white/80 backdrop-blur-sm text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all shadow-sm border border-transparent hover:border-red-100"
                title="Elimina"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredItems.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="col-span-full flex flex-col items-center justify-center py-16 text-center bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-3xl mt-4"
          >
            <span className="text-4xl mb-3">{syncStatus === 'loading' ? '⏳' : '👻'}</span>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">
              {syncStatus === 'loading' ? 'Sincronizzazione in corso…' : 'Nessun servizio trovato'}
            </h3>
            <p className="text-sm text-[var(--text-muted)] mt-1 max-w-sm">
              {syncStatus === 'loading'
                ? 'Attendere prego.'
                : activeTab !== 'TUTTI'
                  ? `Nessun servizio nella categoria ${activeTab}.`
                  : 'Il catalogo è vuoto. Clicca "+ Nuovo" o usa 🔄 per scaricare dal sito.'}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}