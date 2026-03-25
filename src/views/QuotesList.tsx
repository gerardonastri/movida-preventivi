import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Quote } from '../utils/types';

interface QuotesListProps {
  quotes: Quote[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onNew: () => void;
}

export default function QuotesList({ quotes, onEdit, onDelete, onDuplicate, onNew }: QuotesListProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredQuotes = quotes.filter(q => 
    q.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Archivio Preventivi</h1>
        
        {/* Search Bar */}
        <div className="relative w-full md:w-72">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">🔍</span>
          <input 
            type="text" 
            placeholder="Cerca cliente o ID..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-[var(--border)] rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none transition shadow-[var(--shadow-card)]"
          />
        </div>
      </header>

      {quotes.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl shadow-[var(--shadow-card)] border border-[var(--border)]">
          <div className="text-4xl mb-3">🗂️</div>
          <h3 className="text-lg font-medium text-[var(--text-primary)]">Nessun preventivo</h3>
          <p className="text-[var(--text-muted)] mt-1 mb-5">Inizia creando il tuo primo preventivo.</p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={onNew}
            className="bg-[var(--accent)] text-white px-5 py-2.5 rounded-xl shadow-sm font-medium"
          >
            Crea Preventivo
          </motion.button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          <AnimatePresence>
            {filteredQuotes.map((quote) => {
              const total = quote.services.reduce((acc, s) => acc + (s.qty * s.unitPrice), 0);
              const finalPrice = total - ((total * quote.discount) / 100);

              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={quote.id}
                  className="bg-white p-5 rounded-2xl shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-hover)] transition border border-[var(--border)] flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex-1 cursor-pointer" onClick={() => onEdit(quote.id)}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-bold text-[var(--accent)] bg-[var(--accent-soft)] px-2.5 py-1 rounded-md">
                        {quote.id}
                      </span>
                      <span className="font-semibold text-[var(--text-primary)]">
                        {quote.client.name || 'Senza Nome'}
                      </span>
                    </div>
                    <div className="text-sm text-[var(--text-secondary)] flex gap-4">
                      <span>📅 {quote.client.date || '-'}</span>
                      <span>📍 {quote.client.location || '-'}</span>
                      <span className="font-medium text-[var(--text-primary)]">€{finalPrice.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 border-t md:border-t-0 md:border-l border-[var(--border)] pt-4 md:pt-0 md:pl-4">
                    <button 
                      onClick={() => onDuplicate(quote.id)}
                      className="p-2 text-[var(--text-secondary)] hover:text-(--accent) hover:bg-(--bg-tertiary) rounded-lg transition"
                      title="Duplica"
                    >
                      📄
                    </button>
                    <button 
                      onClick={() => onDelete(quote.id)}
                      className="p-2 text-(--text-secondary) hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                      title="Elimina"
                    >
                      🗑️
                    </button>
                    <button 
                      onClick={() => onEdit(quote.id)}
                      className="px-4 py-2 bg-(--bg-tertiary) hover:bg-(--border) text-(--text-primary) text-sm font-medium rounded-lg transition ml-2"
                    >
                      Apri
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {filteredQuotes.length === 0 && searchTerm !== '' && (
            <p className="text-center text-(--text-muted) py-8">Nessun risultato per "{searchTerm}"</p>
          )}
        </div>
      )}
    </div>
  );
}