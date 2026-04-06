import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import type { Quote } from '../utils/types';
import { saveQuote } from '../utils/storage';

interface DashboardProps {
  quotes: Quote[];
  onNew: () => void;
  onEdit: (id: string) => void;
  onQuotesChange: (quotes: Quote[]) => void; // callback per aggiornare lo stato in App
}

// Calcola il totale reale di un preventivo (sconto globale + sconti per item)
function calcTotal(quote: Quote): number {
  const subtotal = quote.services.reduce((sum, s) => sum + s.qty * s.unitPrice, 0);
  const itemDiscounts = quote.services.reduce((sum, s) => sum + (s.itemDiscount || 0), 0);
  return subtotal - (quote.discount || 0) - itemDiscounts;
}

const STATUS_LABELS: Record<Quote['status'], string> = {
  draft: 'BOZZA',
  sent: 'INVIATO',
  confirmed: 'CONFERMATO',
};

const STATUS_STYLES: Record<Quote['status'], string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-green-100 text-green-700',
};

const STATUS_ORDER: Quote['status'][] = ['draft', 'sent', 'confirmed'];

export default function Dashboard({ quotes, onNew, onEdit, onQuotesChange }: DashboardProps) {
  const [changingStatusId, setChangingStatusId] = useState<string | null>(null);

  // ---- STATS ----
  // Tutti i preventivi (anche contratti)
  const totalQuotes = quotes.length;
  const confirmedQuotes = quotes.filter(q => q.status === 'confirmed');
  const draftQuotes = quotes.filter(q => q.status === 'draft');
  const sentQuotes = quotes.filter(q => q.status === 'sent');

  // Fatturato = somma dei totali di TUTTI i confermati (preventivi + contratti)
  const totalRevenue = confirmedQuotes.reduce((acc, q) => acc + calcTotal(q), 0);

  // Fatturato potenziale = tutto (incluso inviati)
  const potentialRevenue = quotes
    .filter(q => q.status !== 'draft')
    .reduce((acc, q) => acc + calcTotal(q), 0);

  const recentQuotes = quotes.slice(0, 6);

  // ---- CAMBIO STATUS ----
  const handleStatusChange = (quote: Quote, newStatus: Quote['status']) => {
    const updated = { ...quote, status: newStatus };
    saveQuote(updated);
    // Aggiorna lo stato locale in App tramite callback
    const newQuotes = quotes.map(q => q.id === quote.id ? updated : q);
    onQuotesChange(newQuotes);
    setChangingStatusId(null);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Dashboard</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Benvenuto nel tuo Event Manager.</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={onNew}
          className="bg-[var(--accent)] text-white px-5 py-3 rounded-xl shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-hover)] transition font-medium flex items-center justify-center gap-2"
        >
          <span className="text-xl leading-none">+</span> Nuovo Preventivo
        </motion.button>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-white rounded-2xl p-5 shadow-[var(--shadow-card)] border border-[var(--border)]"
        >
          <p className="text-xs text-[var(--text-muted)] font-medium mb-1 uppercase tracking-wide">Totali</p>
          <p className="text-3xl font-bold text-[var(--text-primary)]">{totalQuotes}</p>
          <p className="text-[11px] text-[var(--text-muted)] mt-1">
            {sentQuotes.length} inviati
          </p>
        </motion.div>

        <motion.div
          whileHover={{ y: -2 }}
          className="bg-white rounded-2xl p-5 shadow-[var(--shadow-card)] border border-[var(--border)]"
        >
          <p className="text-xs text-[var(--text-muted)] font-medium mb-1 uppercase tracking-wide">Confermati</p>
          <p className="text-3xl font-bold text-green-600">{confirmedQuotes.length}</p>
          <p className="text-[11px] text-[var(--text-muted)] mt-1">
            su {totalQuotes} totali
          </p>
        </motion.div>

        <motion.div
          whileHover={{ y: -2 }}
          className="bg-white rounded-2xl p-5 shadow-[var(--shadow-card)] border border-[var(--border)]"
        >
          <p className="text-xs text-[var(--text-muted)] font-medium mb-1 uppercase tracking-wide">Bozze</p>
          <p className="text-3xl font-bold text-gray-400">{draftQuotes.length}</p>
          <p className="text-[11px] text-[var(--text-muted)] mt-1">
            da completare
          </p>
        </motion.div>

        <motion.div
          whileHover={{ y: -2 }}
          className="bg-blue-50 rounded-2xl p-5 shadow-[var(--shadow-card)] border border-blue-100"
        >
          <p className="text-xs text-blue-500 font-medium mb-1 uppercase tracking-wide">Fatturato</p>
          <p className="text-3xl font-bold text-blue-700">
            €{totalRevenue.toLocaleString('it-IT', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-[11px] text-blue-400 mt-1">
            €{potentialRevenue.toLocaleString('it-IT', { maximumFractionDigits: 0 })} potenziale
          </p>
        </motion.div>
      </div>

      {/* Recent Quotes */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-[var(--text-primary)]">Ultimi Documenti</h2>
          <p className="text-xs text-[var(--text-muted)]">
            Clicca sullo stato per cambiarlo
          </p>
        </div>

        {recentQuotes.length > 0 ? (
          <div className="grid grid-cols-1 gap-3">
            {recentQuotes.map((quote) => {
              const total = calcTotal(quote);
              const isChangingThis = changingStatusId === quote.id;

              return (
                <motion.div
                  key={quote.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-xl p-4 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-hover)] transition border border-[var(--border)] flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  {/* Info preventivo — cliccabile per aprire */}
                  <div
                    className="flex-1 cursor-pointer min-w-0"
                    onClick={() => onEdit(quote.id)}
                  >
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        quote.documentType === 'contratto'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-[var(--accent-soft)] text-[var(--accent)]'
                      }`}>
                        {quote.documentType === 'contratto' ? '📝' : '📋'} {quote.id}
                      </span>
                      <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
                        {quote.client.name || 'Cliente Senza Nome'}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">
                      {quote.client.eventType || 'Evento'} •{' '}
                      {quote.client.date
                        ? new Date(quote.client.date).toLocaleDateString('it-IT')
                        : 'Data da definire'}{' '}
                      {quote.client.location ? `• ${quote.client.location}` : ''}
                    </p>
                  </div>

                  {/* Totale + Status picker */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-bold text-[var(--text-primary)]">
                      €{total.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>

                    {/* Status badge — cliccabile */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setChangingStatusId(isChangingThis ? null : quote.id);
                        }}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-full transition hover:opacity-80 flex items-center gap-1 ${STATUS_STYLES[quote.status]}`}
                        title="Clicca per cambiare stato"
                      >
                        {STATUS_LABELS[quote.status]}
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>

                      {/* Dropdown stati */}
                      <AnimatePresence>
                        {isChangingThis && (
                          <motion.div
                            initial={{ opacity: 0, y: 6, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 6, scale: 0.95 }}
                            className="absolute right-0 top-full mt-1 bg-white border border-[var(--border)] rounded-xl shadow-xl z-20 overflow-hidden w-36"
                          >
                            {STATUS_ORDER.map(status => (
                              <button
                                key={status}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatusChange(quote, status);
                                }}
                                className={`w-full text-left px-3 py-2.5 text-xs font-semibold transition hover:bg-[var(--bg-tertiary)] flex items-center gap-2 ${
                                  quote.status === status ? 'opacity-50 cursor-default' : ''
                                }`}
                                disabled={quote.status === status}
                              >
                                <span className={`inline-block w-2 h-2 rounded-full ${
                                  status === 'confirmed' ? 'bg-green-500' :
                                  status === 'sent' ? 'bg-blue-500' : 'bg-gray-400'
                                }`} />
                                {STATUS_LABELS[status]}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-[var(--border)]">
            <p className="text-[var(--text-muted)] mb-4">Nessun preventivo ancora creato.</p>
            <button onClick={onNew} className="text-[var(--accent)] font-medium hover:underline">
              Crea il tuo primo preventivo
            </button>
          </div>
        )}
      </section>
    </div>
  );
}