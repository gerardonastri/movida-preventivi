import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar          from './components/Sidebar';
import OfflineIndicator from './components/OfflineIndicator';
import Dashboard  from './views/Dashboard';
import NewQuote   from './views/NewQuote';
import QuotesList from './views/QuotesList';
import Catalog    from './views/Catalog';
import Settings   from './views/Settings';

import { useAppData, type SyncState } from './utils/useAppData';
import { dbNextQuoteId }              from './utils/db';
import { getNextQuoteId, consumeQuoteId } from './utils/storage';
import type { Quote, View } from './utils/types';

const mobileNav: { id: View; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Home',     icon: '▦'  },
  { id: 'new',       label: 'Nuovo',    icon: '+'  },
  { id: 'quotes',    label: 'Lista',    icon: '≡'  },
  { id: 'catalog',   label: 'Catalogo', icon: '🏷️' },
  { id: 'settings',  label: 'Config',   icon: '⚙'  },
];

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0,  transition: { duration: 0.2 } },
  exit:    { opacity: 0, y: -6, transition: { duration: 0.15 } },
};

function SyncIndicator({ state }: { state: SyncState }) {
  if (state === 'idle') return null;
  const cfg = {
    syncing: { dot: 'bg-amber-400 animate-pulse', label: 'Sincronizzazione…' },
    ok:      { dot: 'bg-green-500',               label: 'Sincronizzato'      },
    error:   { dot: 'bg-red-400',                 label: 'Offline'            },
  }[state as 'syncing' | 'ok' | 'error'];
  return (
    <div className="fixed top-3 right-3 z-50 flex items-center gap-2 bg-white border border-[var(--border)] px-3 py-1.5 rounded-full shadow-sm text-xs font-medium text-[var(--text-secondary)] pointer-events-none">
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </div>
  );
}

export default function App() {
  const [view,      setView]      = useState<View>('dashboard');
  const [editingId, setEditingId] = useState<string | null>(null);

  const { quotes, syncState, saveQuote, deleteQuote, setQuotes } = useAppData();

  const handleNewQuote  = () => { setEditingId(null); setView('new'); };
  const handleEditQuote = (id: string) => { setEditingId(id); setView('new'); };

  const handleDuplicateQuote = useCallback(async (id: string) => {
    const original = quotes.find(q => q.id === id);
    if (!original) return;
    let newId: string;
    try   { newId = await dbNextQuoteId(); }
    catch { newId = getNextQuoteId(); consumeQuoteId(); }
    const clone: Quote = {
      ...original,
      id:        newId,
      createdAt: new Date().toISOString(),
      status:    'draft',
      client:    { ...original.client },
      services:  original.services.map(s => ({ ...s, id: crypto.randomUUID() })),
    };
    saveQuote(clone);
  }, [quotes, saveQuote]);

  const currentQuote = editingId ? (quotes.find(q => q.id === editingId) ?? null) : null;

  function renderView() {
    switch (view) {
      case 'dashboard':
        return (
          <Dashboard
            quotes={quotes}
            onNew={handleNewQuote}
            onEdit={handleEditQuote}
            onQuotesChange={setQuotes}
            onSaveQuote={saveQuote}   // ← FIX: usa il saveQuote dell'hook, non l'import diretto
          />
        );

      case 'new':
        return (
          <NewQuote
            key={editingId ?? 'new-quote'}
            initialQuote={currentQuote}
            onSave={(q) => {
              saveQuote(q);
              if (!editingId) setEditingId(q.id);
            }}
            onBack={() => { setView('dashboard'); setEditingId(null); }}
          />
        );

      case 'quotes':
        return (
          <QuotesList
            quotes={quotes}
            onEdit={handleEditQuote}
            onDelete={deleteQuote}
            onDuplicate={handleDuplicateQuote}
            onNew={handleNewQuote}
          />
        );

      case 'catalog':
        return <Catalog />;

      case 'settings':
        return (
          <Settings
            quotes={quotes}   // ← FIX: passa i quotes aggiornati da Supabase per l'export
          />
        );
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <SyncIndicator state={syncState} />
      <OfflineIndicator />
      <Sidebar activeView={view} onNavigate={setView} quoteCount={quotes.length} />
      <main className="md:ml-60 min-h-screen pb-20 md:pb-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={view + (editingId ?? '')}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="p-4 md:p-8 max-w-6xl mx-auto"
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </main>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--border)] flex items-center justify-around px-2 py-2 z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        {mobileNav.map(item => {
          const isActive = view === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                isActive ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
              }`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}