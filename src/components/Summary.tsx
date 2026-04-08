import { useState } from 'react';
import type { QuoteService, Quote } from '../utils/types';
import { DEFAULT_FOOTER_NOTES } from '../utils/types';

interface SummaryProps {
  services: QuoteService[];
  discount: number;
  onDiscountChange: (discount: number) => void;
  selectedNotes: string[];
  onSelectedNotesChange: (notes: string[]) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  documentType: Quote['documentType'];
  onDocumentTypeChange: (type: Quote['documentType']) => void;
  paymentMethod: Quote['paymentMethod'];
  onPaymentMethodChange: (method: Quote['paymentMethod']) => void;
  promoLocale: boolean;
  onPromoLocaleChange: (value: boolean) => void;
}

export default function Summary({
  services,
  discount,
  onDiscountChange,
  selectedNotes,
  onSelectedNotesChange,
  notes,
  onNotesChange,
  documentType,
  onDocumentTypeChange,
  paymentMethod,
  onPaymentMethodChange,
  promoLocale,
  onPromoLocaleChange,
}: SummaryProps) {
  const [notesOpen, setNotesOpen] = useState(false);

  const subtotal      = services.reduce((acc, s) => acc + s.qty * s.unitPrice, 0);
  const itemDiscounts = services.reduce((acc, s) => acc + (s.itemDiscount || 0), 0);
  const total         = subtotal - discount - itemDiscounts;

  // Toggle singola nota nel checkbox
  function toggleNote(note: string) {
    if (selectedNotes.includes(note)) {
      onSelectedNotesChange(selectedNotes.filter(n => n !== note));
    } else {
      onSelectedNotesChange([...selectedNotes, note]);
    }
  }

  const inputCls = 'w-full bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none transition border border-transparent focus:border-[var(--accent)]';
  const labelCls = 'block text-sm font-medium text-[var(--text-secondary)] mb-2 ml-1';

  return (
    <div className="bg-white rounded-2xl p-6 shadow-[var(--shadow-card)] border border-[var(--border)] sticky top-24 space-y-5">
      <h3 className="text-lg font-semibold text-[var(--text-primary)]">Riepilogo & Opzioni</h3>

      {/* ── Tipo Documento ───────────────────────────────────────── */}
      <div>
        <label className={labelCls}>Tipo Documento</label>
        <div className="flex gap-4">
          {(['preventivo', 'contratto'] as Quote['documentType'][]).map(type => (
            <label key={type} className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="radio"
                value={type}
                checked={documentType === type}
                onChange={() => onDocumentTypeChange(type)}
                className="accent-[var(--accent)]"
              />
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </label>
          ))}
        </div>
        {documentType === 'contratto' && (
          <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-3 py-1.5 mt-2">
            ⚠️ La validità del preventivo non verrà stampata sul contratto.
          </p>
        )}
      </div>

      {/* ── Modalità Pagamento ───────────────────────────────────── */}
      <div>
        <label className={labelCls}>Modalità Pagamento</label>
        <div className="flex flex-col gap-2">
          {([
            { value: 'contanti', label: 'Contanti a fine evento' },
            { value: 'bonifico', label: 'Bonifico Bancario Anticipato' },
          ] as { value: Quote['paymentMethod']; label: string }[]).map(opt => (
            <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="radio"
                value={opt.value}
                checked={paymentMethod === opt.value}
                onChange={() => onPaymentMethodChange(opt.value)}
                className="accent-[var(--accent)]"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {/* ── PROMO LOCALE ─────────────────────────────────────────── */}
      <div className={`rounded-xl border-2 p-3 transition-all ${
        promoLocale
          ? 'border-orange-400 bg-orange-50'
          : 'border-[var(--border)] bg-[var(--bg-tertiary)]'
      }`}>
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div
            onClick={() => onPromoLocaleChange(!promoLocale)}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
              promoLocale ? 'bg-orange-500' : 'bg-gray-300'
            }`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
              promoLocale ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </div>
          <div>
            <div className={`text-sm font-bold ${promoLocale ? 'text-orange-700' : 'text-[var(--text-primary)]'}`}>
              PROMO LOCALE
            </div>
            <div className="text-[11px] text-[var(--text-muted)] leading-tight mt-0.5">
              Nasconde tutti gli importi sul PDF. Il pagamento avviene direttamente con la struttura.
            </div>
          </div>
        </label>
      </div>

      <hr className="border-[var(--border)]" />

      {/* ── Totali (nascosti se Promo Locale) ───────────────────── */}
      {promoLocale ? (
        <div className="text-center py-4 rounded-xl border-2 border-dashed border-orange-300 bg-orange-50">
          <p className="text-lg font-bold text-orange-600 tracking-widest">PROMO LOCALE</p>
          <p className="text-xs text-orange-500 mt-1">Gli importi non verranno stampati</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-between text-sm text-[var(--text-secondary)]">
            <span>Subtotale ({services.length} servizi)</span>
            <span>€{subtotal.toFixed(2)}</span>
          </div>

          {itemDiscounts > 0 && (
            <div className="flex justify-between text-sm text-red-500 font-medium">
              <span>Sconti su righe</span>
              <span>- €{itemDiscounts.toFixed(2)}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
            <span>Sconto globale (€)</span>
            <div className="w-28 relative">
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

          <div className="bg-[var(--accent-soft)] rounded-xl p-5 flex items-center justify-between">
            <span className="text-[var(--accent)] font-semibold text-lg">Totale</span>
            <span className="text-3xl font-bold text-[var(--accent)]">€{total.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* ── Note a piè di pagina — CHECKBOX MULTIPLI ────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={labelCls + ' mb-0'}>Note a piè di pagina</label>
          <button
            type="button"
            onClick={() => setNotesOpen(v => !v)}
            className="text-xs text-[var(--accent)] font-semibold hover:underline flex items-center gap-1"
          >
            {notesOpen ? '▲ Chiudi' : `▼ Scegli (${selectedNotes.length} selezionate)`}
          </button>
        </div>

        {/* Lista checkbox — collassabile */}
        {notesOpen && (
          <div className="mb-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl overflow-hidden divide-y divide-[var(--border)]">
            {DEFAULT_FOOTER_NOTES.map((note) => {
              const checked = selectedNotes.includes(note);
              return (
                <label
                  key={note}
                  className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                    checked
                      ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                      : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleNote(note)}
                    className="accent-[var(--accent)] mt-0.5 flex-shrink-0"
                  />
                  <span className="text-xs leading-tight">{note}</span>
                </label>
              );
            })}

            {/* Deseleziona tutte */}
            {selectedNotes.length > 0 && (
              <button
                type="button"
                onClick={() => onSelectedNotesChange([])}
                className="w-full px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition text-left font-medium"
              >
                ✕ Deseleziona tutte
              </button>
            )}
          </div>
        )}

        {/* Preview note selezionate (sempre visibile anche quando chiuso) */}
        {!notesOpen && selectedNotes.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {selectedNotes.map(n => (
              <span
                key={n}
                className="text-[10px] bg-[var(--accent-soft)] text-[var(--accent)] px-2 py-0.5 rounded-full font-medium line-clamp-1 max-w-[180px] truncate"
                title={n}
              >
                {n}
              </span>
            ))}
          </div>
        )}

        {/* Testo libero aggiuntivo */}
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Note libere aggiuntive (opzionale)..."
          rows={2}
          className={inputCls + ' resize-none'}
        />
      </div>
    </div>
  );
}