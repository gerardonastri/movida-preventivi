import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

type DocTab = 'tutti' | 'preventivo' | 'contratto';

export default function QuotesList({ quotes, onEdit, onDelete, onDuplicate, onNew }: QuotesListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [docTab, setDocTab] = useState<DocTab>('tutti');
  const [selectedYear, setSelectedYear] = useState<string>('tutti');
  const [quoteForPdf, setQuoteForPdf] = useState<Quote | null>(null);
  const settings = getSettings();

  // Anni disponibili estratti dai preventivi
  const availableYears = Array.from(
    new Set(
      quotes
        .map(q => q.client.date ? new Date(q.client.date).getFullYear().toString() : null)
        .filter(Boolean) as string[]
    )
  ).sort((a, b) => Number(b) - Number(a));

  // Filtri combinati
  const filteredQuotes = quotes.filter(q => {
    const matchSearch =
      q.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.client.location || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchDoc = docTab === 'tutti' || q.documentType === docTab;

    const quoteYear = q.client.date ? new Date(q.client.date).getFullYear().toString() : null;
    const matchYear = selectedYear === 'tutti' || quoteYear === selectedYear;

    return matchSearch && matchDoc && matchYear;
  });

  // Stats per i tab
  const countPreventivi = quotes.filter(q => q.documentType === 'preventivo').length;
  const countContratti = quotes.filter(q => q.documentType === 'contratto').length;

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

  const tabClass = (active: boolean) =>
    `px-4 py-2 rounded-xl text-sm font-semibold transition whitespace-nowrap ${
      active
        ? 'bg-[var(--accent)] text-white shadow-sm'
        : 'bg-white text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--bg-tertiary)]'
    }`;

  return (
    <div className="space-y-6 relative">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Archivio Documenti</h1>
          <div className="relative w-full md:w-72">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">🔍</span>
            <input
              type="text"
              placeholder="Cerca cliente, ID, location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-[var(--border)] rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none transition shadow-[var(--shadow-card)]"
            />
          </div>
        </div>

        {/* Filtri: tipo documento + anno */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Tab tipo documento */}
          <button onClick={() => setDocTab('tutti')} className={tabClass(docTab === 'tutti')}>
            Tutti ({quotes.length})
          </button>
          <button onClick={() => setDocTab('preventivo')} className={tabClass(docTab === 'preventivo')}>
            📋 Preventivi ({countPreventivi})
          </button>
          <button onClick={() => setDocTab('contratto')} className={tabClass(docTab === 'contratto')}>
            📝 Contratti ({countContratti})
          </button>

          {/* Separatore */}
          {availableYears.length > 0 && (
            <div className="w-px h-6 bg-[var(--border)] mx-1" />
          )}

          {/* Filtro anno */}
          {availableYears.length > 0 && (
            <>
              <button
                onClick={() => setSelectedYear('tutti')}
                className={tabClass(selectedYear === 'tutti')}
              >
                Tutti gli anni
              </button>
              {availableYears.map(year => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={tabClass(selectedYear === year)}
                >
                  {year}
                </button>
              ))}
            </>
          )}
        </div>
      </header>

      {quotes.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl shadow-[var(--shadow-card)] border border-[var(--border)]">
          <div className="text-4xl mb-3">🗂️</div>
          <h3 className="text-lg font-medium text-[var(--text-primary)]">Nessun documento</h3>
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
              const subtotal = quote.services.reduce((acc, s) => acc + (s.qty * s.unitPrice), 0);
              const itemDiscounts = quote.services.reduce((acc, s) => acc + (s.itemDiscount || 0), 0);
              const finalPrice = subtotal - (quote.discount || 0) - itemDiscounts;
              const isContratto = quote.documentType === 'contratto';

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
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${
                        isContratto
                          ? 'text-emerald-700 bg-emerald-50'
                          : 'text-[var(--accent)] bg-[var(--accent-soft)]'
                      }`}>
                        {isContratto ? '📝 CONTRATTO' : '📋 PREV.'} · {quote.id}
                      </span>
                      <span className="font-semibold text-[var(--text-primary)]">
                        {quote.client.name || 'Senza Nome'}
                      </span>
                    </div>
                    <div className="text-sm text-[var(--text-secondary)] flex flex-wrap gap-4">
                      <span>📅 {quote.client.date || '-'}</span>
                      <span>📍 {quote.client.location || '-'}</span>
                      <span className="font-medium text-[var(--text-primary)]">€{finalPrice.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 border-t md:border-t-0 md:border-l border-[var(--border)] pt-4 md:pt-0 md:pl-4">
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

          {filteredQuotes.length === 0 && (
            <p className="text-center text-[var(--text-muted)] py-8">
              Nessun risultato per i filtri selezionati.
            </p>
          )}
        </div>
      )}

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