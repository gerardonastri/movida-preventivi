import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getCatalogItems,
  saveCatalogItems,
  fetchCatalogFromApi,
  getCatalogLastSync,
  isCatalogCacheStale,
} from '../utils/storage';
import type { CatalogItem } from '../utils/types';

type SyncStatus = 'idle' | 'loading' | 'success' | 'error';

export default function Catalog() {
  const [items, setItems] = useState<CatalogItem[]>(getCatalogItems());
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<string>('TUTTI');

  // Stato sincronizzazione API
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncMessage, setSyncMessage] = useState<string>('');
  const [lastSync, setLastSync] = useState<Date | null>(getCatalogLastSync());
  const [isStale, setIsStale] = useState<boolean>(isCatalogCacheStale());

  // ---------------------------------------------------------------------------
  // Fetch API
  // ---------------------------------------------------------------------------

  const syncFromApi = useCallback(async (force = false) => {
    setSyncStatus('loading');
    setSyncMessage('Sincronizzazione in corso…');

    const result = await fetchCatalogFromApi(force);

    setItems(result.items);
    setLastSync(result.updatedAt);
    setIsStale(false);

    if (result.source === 'api') {
      setSyncStatus('success');
      setSyncMessage(`Catalogo aggiornato dal sito! (${result.items.length} servizi)`);
    } else if (result.source === 'cache') {
      setSyncStatus('idle');
      setSyncMessage('');
    } else {
      setSyncStatus('error');
      setSyncMessage('Impossibile connettersi. Uso catalogo locale.');
    }

    // Reset messaggio dopo 4 secondi
    setTimeout(() => {
      setSyncStatus('idle');
      setSyncMessage('');
    }, 4000);
  }, []);

  // Fetch automatico all'avvio se la cache è scaduta o assente
  useEffect(() => {
    if (isStale) {
      syncFromApi(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Catalog CRUD (modifiche manuali)
  // ---------------------------------------------------------------------------

  const updateItems = (newItems: CatalogItem[]) => {
    setItems(newItems);
    saveCatalogItems(newItems);
  };

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
    if (confirm("Vuoi eliminare questo servizio dal catalogo?")) {
      updateItems(items.filter(item => item.id !== id));
    }
  };

  const handleFactoryReset = () => {
    if (confirm("Attenzione: Questo cancellerà le tue modifiche locali e ricaricherà il catalogo dal sito Movida. Vuoi procedere?")) {
      localStorage.removeItem('preventivi_catalog');
      localStorage.removeItem('preventivi_catalog_api');
      localStorage.removeItem('preventivi_catalog_api_timestamp');
      window.location.reload();
    }
  };

  // ---------------------------------------------------------------------------
  // Smart Filters
  // ---------------------------------------------------------------------------

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    items.forEach(item => {
      const match = item.name.match(/^\[(.*?)\]/);
      if (match) tags.add(match[1].toUpperCase());
      else tags.add('ALTRO');
    });
    return Array.from(tags).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchTestuale =
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.details.toLowerCase().includes(searchTerm.toLowerCase());

      const match = item.name.match(/^\[(.*?)\]/);
      const itemTag = match ? match[1].toUpperCase() : 'ALTRO';
      const matchTab = activeTab === 'TUTTI' || itemTag === activeTab;

      return matchTestuale && matchTab;
    });
  }, [items, searchTerm, activeTab]);

  const inputClass =
    "w-full bg-transparent text-[var(--text-primary)] rounded-lg px-3 py-2 outline-none transition hover:bg-[var(--bg-tertiary)] focus:bg-white focus:ring-2 focus:ring-[var(--accent)]";

  // ---------------------------------------------------------------------------
  // Helpers UI
  // ---------------------------------------------------------------------------

  const formatSyncDate = (date: Date | null): string => {
    if (!date) return 'Mai sincronizzato';
    const now = Date.now();
    const diff = now - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h fa`;
    if (minutes > 0) return `${minutes}m fa`;
    return 'Adesso';
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="pb-24">
      {/* Header Sticky */}
      <div className="sticky top-0 z-20 bg-[var(--bg-primary)]/80 backdrop-blur-lg pt-4 pb-4 -mx-4 px-4 md:mx-0 md:px-0 border-b border-[var(--border)] mb-6">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
              Catalogo Servizi
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-0.5 font-medium">
              I tuoi pacchetti intelligenti per preventivi lampo.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 md:gap-3 items-center">
            {/* Barra di ricerca */}
            <div className="relative flex-1 md:flex-none">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              <input
                type="text"
                placeholder="Cerca un pacchetto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-[var(--border)] rounded-xl pl-9 pr-4 py-2.5 text-sm shadow-sm outline-none focus:border-[var(--accent)] transition"
              />
            </div>

            {/* Bottone Sync API */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => syncFromApi(true)}
              disabled={syncStatus === 'loading'}
              title="Aggiorna dal sito Movida"
              className={`relative px-3 py-2.5 rounded-xl text-sm font-semibold transition flex items-center gap-2 border
                ${syncStatus === 'loading'
                  ? 'bg-blue-50 border-blue-200 text-blue-400 cursor-wait'
                  : syncStatus === 'success'
                    ? 'bg-green-50 border-green-200 text-green-600'
                    : syncStatus === 'error'
                      ? 'bg-red-50 border-red-200 text-red-500'
                      : isStale
                        ? 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100'
                        : 'bg-[var(--bg-tertiary)] border-[var(--border)] text-[var(--text-secondary)] hover:bg-gray-200'
                }`}
            >
              <span
                className={`text-base ${syncStatus === 'loading' ? 'animate-spin inline-block' : ''}`}
                style={syncStatus === 'loading' ? { display: 'inline-block' } : {}}
              >
                {syncStatus === 'loading' ? '⏳' : syncStatus === 'success' ? '✅' : syncStatus === 'error' ? '❌' : '🔄'}
              </span>
              <span className="hidden md:inline">
                {syncStatus === 'loading'
                  ? 'Aggiorno…'
                  : syncStatus === 'success'
                    ? 'Aggiornato!'
                    : syncStatus === 'error'
                      ? 'Errore'
                      : isStale
                        ? 'Aggiorna catalogo'
                        : 'Sincronizzato'}
              </span>

              {/* Badge rosso se stale e idle */}
              {isStale && syncStatus === 'idle' && (
                <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-amber-400 rounded-full border-2 border-white" />
              )}
            </motion.button>

            {/* Reset Factory */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleFactoryReset}
              className="px-3 py-2.5 bg-[var(--bg-tertiary)] hover:bg-gray-200 text-[var(--text-secondary)] rounded-xl text-sm font-semibold transition"
              title="Reset completo: scarica tutto dal sito"
            >
              🗑️
            </motion.button>

            {/* Nuovo item manuale */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleAddItem}
              className="bg-[var(--accent)] text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-[0_4px_14px_rgba(37,99,235,0.25)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.3)] transition whitespace-nowrap"
            >
              + Nuovo
            </motion.button>
          </div>
        </header>

        {/* Riga info sincronizzazione */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {/* Messaggio di feedback sync */}
            <AnimatePresence>
              {syncMessage && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`text-xs font-medium px-3 py-1 rounded-full
                    ${syncStatus === 'error'
                      ? 'bg-red-50 text-red-500'
                      : syncStatus === 'success'
                        ? 'bg-green-50 text-green-600'
                        : 'bg-blue-50 text-blue-500'
                    }`}
                >
                  {syncMessage}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Timestamp ultimo sync */}
          <p className="text-[11px] text-[var(--text-muted)] font-medium">
            🕐 Aggiornato: {formatSyncDate(lastSync)}
          </p>
        </div>

        {/* Smart Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide snap-x">
          <button
            onClick={() => setActiveTab('TUTTI')}
            className={`snap-start whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all
              ${activeTab === 'TUTTI'
                ? 'bg-gray-900 text-white shadow-md'
                : 'bg-white text-gray-500 border border-[var(--border)] hover:bg-gray-50'}`}
          >
            TUTTI
          </button>
          {availableTags.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTab(tag)}
              className={`snap-start whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all
                ${activeTab === tag
                  ? 'bg-[var(--accent)] text-white shadow-[0_2px_10px_rgba(37,99,235,0.2)]'
                  : 'bg-white text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--bg-tertiary)]'}`}
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
              animate={{ opacity: 1, y: 0, transition: { delay: index * 0.04 } }}
              exit={{ opacity: 0, scale: 0.95 }}
              key={item.id}
              className="bg-white p-5 rounded-2xl shadow-sm border border-[var(--border)] hover:shadow-md transition-shadow group relative overflow-hidden"
            >
              <div className="flex flex-col gap-3">
                {/* Rigo Superiore: Nome e Prezzo */}
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

                {/* Rigo Inferiore: Dettagli e Note */}
                <div className="space-y-1 relative">
                  <textarea
                    placeholder="Dettagli servizio (ciò che il cliente acquista, testo grigio in PDF)..."
                    value={item.details}
                    onChange={(e) => handleChange(item.id, 'details', e.target.value)}
                    rows={2}
                    className={`${inputClass} resize-none text-xs font-medium text-gray-600 leading-relaxed`}
                  />
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                    <textarea
                      placeholder="Note operative o vincoli (es. Max 28 bimbi, testo azzurro in PDF)..."
                      value={item.notes}
                      onChange={(e) => handleChange(item.id, 'notes', e.target.value)}
                      rows={1}
                      className={`${inputClass} pl-7 resize-none text-[11px] font-semibold text-blue-600/80 leading-snug`}
                    />
                  </div>
                </div>
              </div>

              {/* Tasto Cancella */}
              <button
                onClick={() => handleDelete(item.id)}
                className="absolute top-4 right-4 md:opacity-0 md:group-hover:opacity-100 p-2 bg-white/80 backdrop-blur-sm text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all shadow-sm border border-transparent hover:border-red-100"
                title="Elimina"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18"></path>
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
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
            <span className="text-4xl mb-3">
              {syncStatus === 'loading' ? '⏳' : '👻'}
            </span>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">
              {syncStatus === 'loading' ? 'Scarico il catalogo…' : 'Nessun servizio trovato'}
            </h3>
            <p className="text-sm text-[var(--text-muted)] mt-1 max-w-sm">
              {syncStatus === 'loading'
                ? 'Sto scaricando i servizi dal sito Movida, un attimo.'
                : activeTab !== 'TUTTI'
                  ? `Non hai ancora servizi nella categoria ${activeTab}.`
                  : 'Il catalogo è vuoto. Clicca su "+ Nuovo" per iniziare oppure usa 🔄 per scaricare dal sito.'}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}