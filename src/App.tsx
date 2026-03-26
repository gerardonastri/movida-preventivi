import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './components/Sidebar';
// FIX: Aggiornati i metodi importati dallo storage per risolvere il bug della concorrenza ID
import { getQuotes, saveQuote, deleteQuote, generateQuoteId } from './utils/storage';
import type { Quote } from './utils/types';

import Dashboard  from './views/Dashboard';
import NewQuote   from './views/NewQuote';
import QuotesList from './views/QuotesList';
import Settings   from './views/Settings';

type View = 'dashboard' | 'new' | 'quotes' | 'settings';

// Mobile bottom nav
const mobileNav: { id: View; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Home',       icon: '▦' },
  { id: 'new',       label: 'Nuovo',      icon: '+' },
  { id: 'quotes',    label: 'Lista',      icon: '≡' },
  { id: 'settings',  label: 'Config',     icon: '⚙' },
];

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2 } },
  exit:    { opacity: 0, y: -6, transition: { duration: 0.15 } },
};

export default function App() {
  const [view, setView]       = useState<View>('dashboard');
  const [quotes, setQuotes]   = useState<Quote[]>(() => getQuotes());
  const [editingId, setEditingId] = useState<string | null>(null);

  // Nuovo preventivo vuoto
  function handleNewQuote() {
    setEditingId(null);
    setView('new');
  }

  // Apri un preventivo esistente in modifica
  function handleEditQuote(id: string) {
    setEditingId(id);
    setView('new');
  }

  // Salva preventivo (crea o aggiorna)
  function handleSaveQuote(quote: Quote) {
    saveQuote(quote);
    const updated = getQuotes();
    setQuotes(updated);
  }

  // Elimina preventivo
  function handleDeleteQuote(id: string) {
    deleteQuote(id);
    setQuotes(getQuotes());
  }

  // Duplica preventivo
  function handleDuplicateQuote(id: string) {
    const original = quotes.find(q => q.id === id);
    if (!original) return;
    
    const clone: Quote = {
      ...original,
      id: generateQuoteId(), // Usiamo il nuovo ID sicuro
      createdAt: new Date().toISOString(),
      status: 'draft',
      client: { ...original.client },
      services: original.services.map(s => ({ ...s })),
    };
    saveQuote(clone);
    setQuotes(getQuotes());
  }

  const currentQuote = editingId
    ? quotes.find(q => q.id === editingId) ?? null
    : null;

  function renderView() {
    switch (view) {
      case 'dashboard':
        return (
          <Dashboard
            quotes={quotes}
            onNew={handleNewQuote}
            onEdit={handleEditQuote}
          />
        );
      case 'new':
        return (
          <NewQuote
            key={editingId ?? 'new'}
            initialQuote={currentQuote}
            onSave={handleSaveQuote}
            onBack={() => setView('dashboard')}
          />
        );
      case 'quotes':
        return (
          <QuotesList
            quotes={quotes}
            onEdit={handleEditQuote}
            onDelete={handleDeleteQuote}
            onDuplicate={handleDuplicateQuote}
            onNew={handleNewQuote}
          />
        );
      case 'settings':
        return <Settings />;
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Sidebar desktop */}
      <Sidebar
        activeView={view}
        onNavigate={setView}
        quoteCount={quotes.length}
      />

      {/* Main content — offset per sidebar su desktop */}
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

      {/* Bottom nav mobile */}
      <nav className="
        md:hidden fixed bottom-0 left-0 right-0
        bg-white border-t border-[var(--border)]
        flex items-center justify-around
        px-2 py-2 z-20
        shadow-[0_-4px_20px_rgba(0,0,0,0.06)]
      ">
        {mobileNav.map(item => {
          const isActive = view === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`
                flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl
                text-xs font-medium transition-colors
                ${isActive ? 'text-accent' : 'text-[var(--text-muted)]'}
              `}
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