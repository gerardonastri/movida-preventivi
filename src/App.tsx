import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './components/Sidebar';
import OfflineIndicator from './components/OfflineIndicator';
import Dashboard from './views/Dashboard';
import NewQuote from './views/NewQuote';
import QuotesList from './views/QuotesList';
import Catalog from './views/Catalog';
import Settings from './views/Settings';
import LocationsManager from './views/LocationsManager';
import FooterNotesManager from './views/FooterNotesManager'; 
import { useAppData, type SyncState } from './utils/useAppData';
import { getNextQuoteId } from './utils/storage';
import type { Quote, View } from './utils/types';

// ── MODIFICA: 'locations' → 'locations-notes' in mobileNav ──────────────────
const mobileNav: { id: View; label: string; icon: string }[] = [
  { id: 'dashboard',       label: 'Home',      icon: '▦'  },
  { id: 'new',             label: 'Nuovo',     icon: '+'  },
  { id: 'quotes',          label: 'Lista',     icon: '≡'  },
  { id: 'catalog',         label: 'Catalogo',  icon: '🏷️' },
  { id: 'locations-notes', label: 'Strutture', icon: '📋' },
  { id: 'settings',        label: 'Config',    icon: '⚙'  },
];

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2 } },
  exit:    { opacity: 0, y: -6, transition: { duration: 0.15 } },
};

function SyncIndicator({ state }: { state: SyncState }) {
  if (state === 'idle') return null;
  const cfg = {
    syncing: { dot: 'bg-amber-400 animate-pulse', label: 'Sincronizzazione…' },
    ok:      { dot: 'bg-green-500',               label: 'Sincronizzato'     },
    error:   { dot: 'bg-red-400',                 label: 'Offline'           },
  }[state as 'syncing' | 'ok' | 'error'];
  return (
    <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] px-3 py-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </div>
  );
}

export default function App() {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const { quotes, setQuotes, syncState } = useAppData();

  const handleNavigate = useCallback((view: View) => {
    setActiveView(view);
    if (view !== 'new') setEditingQuoteId(null);
  }, []);

  const handleNewQuote = useCallback(() => {
    setEditingQuoteId(null);
    setActiveView('new');
  }, []);

  const handleEditQuote = useCallback((id: string) => {
    setEditingQuoteId(id);
    setActiveView('new');
  }, []);

  const handleQuoteSaved = useCallback((quote: Quote) => {
    const idx = quotes.findIndex(q => q.id === quote.id);
    if (idx >= 0) {
      const n = [...quotes];
      n[idx] = quote;
      setQuotes(n);
    } else {
      setQuotes([quote, ...quotes]);
    }
  }, [quotes, setQuotes]);

  const handleQuoteDeleted = useCallback((id: string) => {
    setQuotes(quotes.filter(q => q.id !== id));
  }, [quotes, setQuotes]);

  const handleQuoteDuplicate = useCallback((id: string) => {
    const quote = quotes.find(q => q.id === id);
    if (quote) {
      const newQuote = { ...quote, id: getNextQuoteId('preventivo') };
      setQuotes([newQuote, ...quotes]);
    }
  }, [quotes, setQuotes]);

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)]">
      <Sidebar activeView={activeView} onNavigate={handleNavigate} quoteCount={quotes.length} />

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--sidebar-bg)] border-t border-[var(--border)] flex">
        {mobileNav.map(item => (
          <button
            key={item.id}
            onClick={() => handleNavigate(item.id)}
            className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-[10px] font-medium transition-colors ${
              activeView === item.id
                ? 'text-[var(--accent)]'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            <span className="text-lg leading-none">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <main className="flex-1 md:ml-56 pb-20 md:pb-0 overflow-x-hidden">
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--sidebar-bg)]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[var(--accent)] flex items-center justify-center text-white font-black text-xs">M</div>
            <span className="font-bold text-[var(--text-primary)] text-sm">Movida Manager</span>
          </div>
          <SyncIndicator state={syncState} />
        </div>

        <AnimatePresence mode="wait">
          {/* FIX: Aggiunta classe per gestire layout, limiti di larghezza e padding globale */}
          <motion.div 
            key={activeView} 
            variants={pageVariants} 
            initial="initial" 
            animate="animate" 
            exit="exit"
            className="p-4 md:p-8 w-full max-w-7xl mx-auto"
          >
            {activeView === 'dashboard' && (
              <Dashboard
                quotes={quotes}
                onNew={handleNewQuote}
                onEdit={handleEditQuote}
                onQuotesChange={setQuotes}
              />
            )}
            {activeView === 'new' && (
              <NewQuote
                initialQuote={editingQuoteId ? quotes.find(q => q.id === editingQuoteId) || null : null}
                onSave={handleQuoteSaved}
                onBack={() => handleNavigate('dashboard')}
              />
            )}
            {activeView === 'quotes' && (
              <QuotesList
                quotes={quotes}
                onEdit={handleEditQuote}
                onDelete={handleQuoteDeleted}
                onDuplicate={handleQuoteDuplicate}
                onNew={handleNewQuote}
              />
            )}
            {activeView === 'catalog' && <Catalog />}
            {/* ── MODIFICA: route 'locations-notes' con tab switcher ──────── */}
            {activeView === 'locations-notes' && (
              <LocationsNotesView />
            )}
            {activeView === 'settings' && <Settings />}
          </motion.div>
        </AnimatePresence>
      </main>

      <OfflineIndicator />
    </div>
  );
}

// ── Wrapper con tab Strutture / Note piè di pagina ───────────────────────────
function LocationsNotesView() {
  const [tab, setTab] = useState<'locations' | 'notes'>('locations');
  return (
    // FIX: Rimosso il padding (p-4 md:p-8) per non creare conflitti con il container padre.
    <div className="w-full">
      <div className="flex gap-2 mb-6 border-b border-[var(--border)] pb-4">
        <button
          onClick={() => setTab('locations')}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
            tab === 'locations'
              ? 'bg-[var(--accent)] text-white shadow-sm'
              : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
          }`}
        >
          📍 Strutture
        </button>
        <button
          onClick={() => setTab('notes')}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
            tab === 'notes'
              ? 'bg-[var(--accent)] text-white shadow-sm'
              : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
          }`}
        >
          📝 Note piè di pagina
        </button>
      </div>
      {tab === 'locations' ? <LocationsManager /> : <FooterNotesManager />}
    </div>
  );
}