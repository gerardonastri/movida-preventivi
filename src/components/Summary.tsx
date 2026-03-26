import type { QuoteService, Quote } from '../utils/types';

interface SummaryProps {
  services: QuoteService[];
  discount: number;
  onDiscountChange: (discount: number) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  documentType: Quote['documentType'];
  onDocumentTypeChange: (type: Quote['documentType']) => void;
  paymentMethod: Quote['paymentMethod'];
  onPaymentMethodChange: (method: Quote['paymentMethod']) => void;
}

export default function Summary({ services, discount, onDiscountChange, notes, onNotesChange, documentType, onDocumentTypeChange, paymentMethod, onPaymentMethodChange }: SummaryProps) {
  const subtotal = services.reduce((acc, item) => acc + (item.qty * item.unitPrice), 0);
  const total = subtotal - discount;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-[var(--shadow-card)] border border-[var(--border)] sticky top-24">
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-5">Riepilogo & Opzioni</h3>

      {/* Opzioni Documento e Pagamento */}
      <div className="mb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Tipo Documento</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" value="preventivo" checked={documentType === 'preventivo'} onChange={() => onDocumentTypeChange('preventivo')} className="accent-[var(--accent)]" /> 
              Preventivo
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" value="contratto" checked={documentType === 'contratto'} onChange={() => onDocumentTypeChange('contratto')} className="accent-[var(--accent)]" /> 
              Contratto
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Modalità Pagamento</label>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" value="contanti" checked={paymentMethod === 'contanti'} onChange={() => onPaymentMethodChange('contanti')} className="accent-[var(--accent)]" /> 
              Contanti a fine evento
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" value="bonifico" checked={paymentMethod === 'bonifico'} onChange={() => onPaymentMethodChange('bonifico')} className="accent-[var(--accent)]" /> 
              Bonifico Bancario Anticipato
            </label>
          </div>
        </div>
      </div>

      <hr className="border-[var(--border)] my-5" />

      {/* Tabella Totali */}
      <div className="space-y-3 mb-6">
        <div className="flex justify-between text-sm text-[var(--text-secondary)]">
          <span>Subtotale servizi ({services.length})</span>
          <span>€{subtotal.toFixed(2)}</span>
        </div>

        <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
          <span>Sconto (€)</span>
          <div className="w-24 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)]">€</span>
            <input type="number" min="0" value={discount || ''} onChange={(e) => onDiscountChange(Number(e.target.value))} placeholder="0" className="w-full bg-[var(--bg-tertiary)] text-right rounded-lg pl-7 pr-3 py-1.5 focus:ring-2 focus:ring-[var(--accent)] outline-none" />
          </div>
        </div>
        
        {discount > 0 && (
          <div className="flex justify-between text-sm text-green-600 font-medium">
            <span>Risparmio</span>
            <span>- €{discount.toFixed(2)}</span>
          </div>
        )}
      </div>

      <div className="bg-[var(--accent-soft)] rounded-xl p-5 flex items-center justify-between mb-6">
        <span className="text-[var(--accent)] font-semibold text-lg">Totale</span>
        <span className="text-3xl font-bold text-[var(--accent)]">€{total.toFixed(2)}</span>
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5 ml-1">Note a fondo pagina (opzionale)</label>
        <textarea value={notes} onChange={(e) => onNotesChange(e.target.value)} placeholder="es. Autorizzazione utilizzo parco..." rows={2} className="w-full bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none transition resize-none" />
      </div>
    </div>
  );
}