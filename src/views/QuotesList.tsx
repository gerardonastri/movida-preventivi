import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// FIX PUNTO 11: Import necessari per il download rapido
import html2pdf from 'html2pdf.js';
import type { Quote } from '../utils/types';
import PdfTemplate from '../components/PdfTemplate';
import { getSettings } from '../utils/storage';

interface QuotesListProps {
  quotes: Quote[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onNew: () => void;
}

export default function QuotesList({ quotes, onEdit, onDelete, onDuplicate, onNew }: QuotesListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // FIX PUNTO 11: Stato per il preventivo da stampare al volo e impostazioni
  const [quoteForPdf, setQuoteForPdf] = useState<Quote | null>(null);
  const settings = getSettings();

  const filteredQuotes = quotes.filter(q => 
    q.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // FIX PUNTO 11: Funzione per il download rapido del PDF dalla lista
  const handleQuickDownload = (quote: Quote) => {
    setQuoteForPdf(quote);
    setTimeout(() => {
      const element = document.getElementById('list-pdf-container');
      if (!element) return;
      const filename = `${quote.id}_${quote.client.name.replace(/\s+/g, '_')}.pdf`;
      const pdf = html2pdf();
      pdf.set({ 
        margin: 0, 
        filename, 
        html2canvas: { scale: 2, backgroundColor: '#ffffff' }, 
        jsPDF: { format: 'a4' } 
      }).from(element).save().then(() => setQuoteForPdf(null));
    }, 200);
  };

  return (
    <div className="space-y-6 relative">
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
              
              // FIX PUNTO 8: Calcolo dello sconto in Euro fisso invece che percentuale
              const finalPrice = total - quote.discount;

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
                    {/* FIX PUNTO 11: Bottone per il Download Rapido */}
                    <button 
                      onClick={() => handleQuickDownload(quote)}
                      className="p-2 text-[var(--text-secondary)] hover:text-blue-500 hover:bg-blue-50 rounded-lg transition"
                      title="Scarica PDF"
                    >
                      📄
                    </button>
                    <button 
                      onClick={() => onDuplicate(quote.id)}
                      className="p-2 text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-tertiary)] rounded-lg transition"
                      title="Duplica"
                    >
                      📋
                    </button>
                    <button 
                      onClick={() => onDelete(quote.id)}
                      className="p-2 text-[var(--text-secondary)] hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                      title="Elimina"
                    >
                      🗑️
                    </button>
                    <button 
                      onClick={() => onEdit(quote.id)}
                      className="px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border)] text-[var(--text-primary)] text-sm font-medium rounded-lg transition ml-2"
                    >
                      Apri
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {filteredQuotes.length === 0 && searchTerm !== '' && (
            <p className="text-center text-[var(--text-muted)] py-8">Nessun risultato per "{searchTerm}"</p>
          )}
        </div>
      )}

      {/* FIX PUNTO 11: Rendering invisibile per il PDF rapido */}
      {quoteForPdf && (
        <div style={{ position: 'absolute', top: '-10000px', left: '-10000px', width: '210mm' }}>
          <div id="list-pdf-container">
            <PdfTemplate quote={quoteForPdf} settings={settings} />
          </div>
        </div>
      )}
    </div>
  );
}