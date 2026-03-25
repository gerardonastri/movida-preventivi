import type { QuoteService } from '../utils/types';

interface SummaryProps {
  services: QuoteService[];
  discount: number;
  onDiscountChange: (discount: number) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
}

export default function Summary({ services, discount, onDiscountChange, notes, onNotesChange }: SummaryProps) {
  const subtotal = services.reduce((acc, item) => acc + (item.qty * item.unitPrice), 0);
  const discountAmount = (subtotal * discount) / 100;
  const total = subtotal - discountAmount;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-[var(--shadow-card)] border border-[var(--border)] sticky top-24">
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-5">Riepilogo</h3>

      {/* Tabella Leggera */}
      <div className="space-y-3 mb-6">
        <div className="flex justify-between text-sm text-[var(--text-secondary)]">
          <span>Subtotale servizi ({services.length})</span>
          <span>€{subtotal.toFixed(2)}</span>
        </div>

        <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
          <span>Sconto (%)</span>
          <div className="w-20 relative">
            <input 
              type="number" 
              min="0" max="100"
              value={discount || ''}
              onChange={(e) => onDiscountChange(Number(e.target.value))}
              placeholder="0"
              className="w-full bg-[var(--bg-tertiary)] text-right rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-[var(--accent)] outline-none"
            />
            <span className="absolute left-2 top-1/2 -translate-y-1/2">%</span>
          </div>
        </div>
        
        {discount > 0 && (
          <div className="flex justify-between text-sm text-green-600 font-medium">
            <span>Risparmio</span>
            <span>- €{discountAmount.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Totale Box Evidenziato */}
      <div className="bg-[var(--accent-soft)] rounded-xl p-5 flex items-center justify-between mb-6">
        <span className="text-[var(--accent)] font-semibold text-lg">Totale</span>
        <span className="text-3xl font-bold text-[var(--accent)]">€{total.toFixed(2)}</span>
      </div>

      {/* Note Aggiuntive */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5 ml-1">
          Note per il cliente (opzionale)
        </label>
        <textarea 
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="es. Modalità di pagamento, richieste speciali..."
          rows={3}
          className="w-full bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none transition resize-none"
        />
      </div>
    </div>
  );
}