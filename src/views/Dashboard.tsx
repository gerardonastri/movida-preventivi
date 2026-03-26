import { motion } from 'framer-motion';
import type { Quote } from '../utils/types';

interface DashboardProps {
  quotes: Quote[];
  onNew: () => void;
  onEdit: (id: string) => void;
}

export default function Dashboard({ quotes, onNew, onEdit }: DashboardProps) {
  // FIX PUNTO 9 e 14: Calcolo statistiche avanzate (Bozze, Confermati, Fatturato Reale)
  const confirmedQuotes = quotes.filter(q => q.status === 'confirmed');
  const draftQuotes = quotes.filter(q => q.status === 'draft');
  const totalQuotes = quotes.length;

  // Il fatturato ora calcola solo i preventivi confermati e usa lo sconto in Euro fisso (Punto 8)
  const totalRevenue = confirmedQuotes.reduce((acc, quote) => {
    const subtotal = quote.services.reduce((sum, s) => sum + (s.qty * s.unitPrice), 0);
    return acc + (subtotal - quote.discount);
  }, 0);

  const recentQuotes = quotes.slice(0, 5); // Mostra solo gli ultimi 5

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

      {/* FIX PUNTO 14: Stats Cards portate a 4 colonne */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-white rounded-2xl p-6 shadow-[var(--shadow-card)] border border-[var(--border)]"
        >
          <p className="text-sm text-[var(--text-secondary)] font-medium mb-1">Preventivi Totali</p>
          <p className="text-3xl font-bold text-[var(--text-primary)]">{totalQuotes}</p>
        </motion.div>
        
        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-white rounded-2xl p-6 shadow-[var(--shadow-card)] border border-[var(--border)]"
        >
          <p className="text-sm text-[var(--text-secondary)] font-medium mb-1">Confermati</p>
          <p className="text-3xl font-bold text-green-600">{confirmedQuotes.length}</p>
        </motion.div>

        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-white rounded-2xl p-6 shadow-[var(--shadow-card)] border border-[var(--border)]"
        >
          <p className="text-sm text-[var(--text-secondary)] font-medium mb-1">Bozze</p>
          <p className="text-3xl font-bold text-gray-500">{draftQuotes.length}</p>
        </motion.div>

        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-blue-50 rounded-2xl p-6 shadow-[var(--shadow-card)] border border-blue-100"
        >
          <p className="text-sm text-blue-600 font-medium mb-1">Fatturato (Conf.)</p>
          <p className="text-3xl font-bold text-blue-700">€{totalRevenue.toFixed(0)}</p>
        </motion.div>
      </div>

      {/* Recent Quotes */}
      <section>
        <h2 className="text-lg font-medium text-[var(--text-primary)] mb-4">Ultimi Preventivi</h2>
        {recentQuotes.length > 0 ? (
          <div className="grid grid-cols-1 gap-3">
            {recentQuotes.map((quote) => (
              <motion.div
                key={quote.id}
                whileHover={{ scale: 1.01 }}
                onClick={() => onEdit(quote.id)}
                className="bg-white rounded-xl p-4 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-hover)] transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between border border-[var(--border)] gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold bg-[var(--bg-tertiary)] text-[var(--text-secondary)] px-2 py-1 rounded-md">
                      {quote.id}
                    </span>
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      {quote.client.name || 'Cliente Senza Nome'}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    {quote.client.eventType || 'Evento'} • {quote.client.date || 'Data da definire'}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    quote.status === 'confirmed' ? 'bg-green-100 text-green-700' : 
                    quote.status === 'sent' ? 'bg-blue-100 text-blue-700' : 
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {quote.status.toUpperCase()}
                  </span>
                </div>
              </motion.div>
            ))}
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