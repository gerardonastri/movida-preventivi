import { useState } from 'react';
import type { QuoteService, Quote } from '../utils/types';
import { DEFAULT_FOOTER_NOTES } from '../utils/types';

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

export default function Summary({
  services,
  discount,
  onDiscountChange,
  notes,
  onNotesChange,
  documentType,
  onDocumentTypeChange,
  paymentMethod,
  onPaymentMethodChange,
}: SummaryProps) {
  const [showNotesPicker, setShowNotesPicker] = useState(false);

  const subtotal = services.reduce((acc, item) => acc + (item.qty * item.unitPrice), 0);
  // FIX: somma anche gli sconti per singolo item
  const itemDiscounts = services.reduce((acc, item) => acc + (item.itemDiscount || 0), 0);
  const total = subtotal - discount - itemDiscounts;

  const handleSelectNote = (note: string) => {
    onNotesChange(note);
    setShowNotesPicker(false);
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-[var(--shadow-card)] border border-[var(--border)] sticky top-24 space-y-5">
      <h3 className="text-lg font-semibold text-[var(--text-primary)]">Riepilogo & Opzioni</h3>

      {/* Tipo Documento */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Tipo Documento</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              value="preventivo"
              checked={documentType === 'preventivo'}
              onChange={() => onDocumentTypeChange('preventivo')}
              className="accent-[var(--accent)]"
            />
            Preventivo
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              value="contratto"
              checked={documentType === 'contratto'}
              onChange={() => onDocumentTypeChange('contratto')}
              className="accent-[var(--accent)]"
            />
            Contratto
          </label>
        </div>
        {documentType === 'contratto' && (
          <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-3 py-1.5 mt-2">
            ⚠️ La validità del preventivo non verrà stampata sul contratto.
          </p>
        )}
      </div>

      {/* Modalità Pagamento */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Modalità Pagamento</label>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              value="contanti"
              checked={paymentMethod === 'contanti'}
              onChange={() => onPaymentMethodChange('contanti')}
              className="accent-[var(--accent)]"
            />
            Contanti a fine evento
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              value="bonifico"
              checked={paymentMethod === 'bonifico'}
              onChange={() => onPaymentMethodChange('bonifico')}
              className="accent-[var(--accent)]"
            />
            Bonifico Bancario Anticipato
          </label>
        </div>
      </div>

      <hr className="border-[var(--border)]" />

      {/* Tabella Totali */}
      <div className="space-y-3">
        <div className="flex justify-between text-sm text-[var(--text-secondary)]">
          <span>Subtotale ({services.length} servizi)</span>
          <span>€{subtotal.toFixed(2)}</span>
        </div>

        {/* Sconti per singolo item */}
        {itemDiscounts > 0 && (
          <div className="flex justify-between text-sm text-red-500 font-medium">
            <span>Sconti su righe</span>
            <span>- €{itemDiscounts.toFixed(2)}</span>
          </div>
        )}

        {/* Sconto globale */}
        <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
          <span>Sconto globale (€)</span>
          <div className="w-24 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)]">€</span>
            <input
              type="number"
              min="0"
              value={discount || ''}
              onChange={(e) => onDiscountChange(Number(e.target.value))}
              placeholder="0"
              className="w-full bg-[var(--bg-tertiary)] text-right rounded-lg pl-7 pr-3 py-1.5 focus:ring-2 focus:ring-[var(--accent)] outline-none"
            />
          </div>
        </div>

        {(discount > 0 || itemDiscounts > 0) && (
          <div className="flex justify-between text-sm text-green-600 font-medium">
            <span>Risparmio totale</span>
            <span>- €{(discount + itemDiscounts).toFixed(2)}</span>
          </div>
        )}
      </div>

      <div className="bg-[var(--accent-soft)] rounded-xl p-5 flex items-center justify-between">
        <span className="text-[var(--accent)] font-semibold text-lg">Totale</span>
        <span className="text-3xl font-bold text-[var(--accent)]">€{total.toFixed(2)}</span>
      </div>

      {/* FIX: Note a piè di pagina con lista preset */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-[var(--text-secondary)] ml-1">
            Note a piè di pagina
          </label>
          <button
            onClick={() => setShowNotesPicker(!showNotesPicker)}
            className="text-xs text-[var(--accent)] font-semibold hover:underline"
          >
            {showNotesPicker ? '✕ Chiudi' : '📋 Scegli'}
          </button>
        </div>

        {/* Lista preset note */}
        {showNotesPicker && (
          <div className="mb-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl overflow-hidden">
            {DEFAULT_FOOTER_NOTES.map((note, i) => (
              <button
                key={i}
                onClick={() => handleSelectNote(note)}
                className={`w-full text-left px-3 py-2.5 text-xs hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] transition ${
                  notes === note ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-semibold' : 'text-[var(--text-secondary)]'
                } ${i > 0 ? 'border-t border-[var(--border)]' : ''}`}
              >
                {note}
              </button>
            ))}
          </div>
        )}

        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="es. Autorizzazione utilizzo parco..."
          rows={2}
          className="w-full bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none transition resize-none"
        />
      </div>
    </div>
  );
}