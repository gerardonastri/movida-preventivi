import { useState } from 'react';
import { motion, Reorder } from 'framer-motion';
import { getCatalogItems } from '../utils/storage';
import type { QuoteService, CatalogItem } from '../utils/types';

interface ServicesListProps {
  services: QuoteService[];
  onChange: (services: QuoteService[]) => void;
}

export default function ServicesList({ services, onChange }: ServicesListProps) {
  const [catalog] = useState<CatalogItem[]>(getCatalogItems());
  const [catalogSearch, setCatalogSearch] = useState('');

  const filteredCatalog = catalog.filter(item =>
    item.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
    item.details.toLowerCase().includes(catalogSearch.toLowerCase())
  );

  const handleAddFromCatalog = (item: CatalogItem) => {
    const newService: QuoteService = {
      id: crypto.randomUUID(),
      name: item.name,
      details: item.details,
      notes: item.notes,
      qty: 1,
      unitPrice: item.price,
      itemDiscount: 0,
      omaggio: false,
    };
    onChange([...services, newService]);
  };

  const handleAddCustom = () => {
    onChange([...services, {
      id: crypto.randomUUID(), name: '', details: '', notes: '',
      qty: 1, unitPrice: 0, itemDiscount: 0, omaggio: false,
    }]);
  };

  const updateService = (id: string, field: keyof QuoteService, value: string | number | boolean) => {
    onChange(services.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const removeService = (id: string) => {
    onChange(services.filter(s => s.id !== id));
  };

  const inputClass = "w-full bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg px-3 py-2 text-sm outline-none transition border border-transparent focus:border-[var(--accent)]";

  return (
    <div className="bg-white rounded-2xl p-6 shadow-[var(--shadow-card)] border border-[var(--border)] space-y-6">
      <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
        <span className="bg-[var(--accent-soft)] text-[var(--accent)] w-8 h-8 rounded-lg flex items-center justify-center">📦</span>
        Servizi e Pacchetti
      </h2>

      {/* Pannello Catalogo con ricerca */}
      <div className="bg-[var(--bg-primary)] p-4 rounded-xl border border-[var(--border)]">
        <div className="flex justify-between items-center mb-3">
          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            Aggiungi dal Catalogo
          </p>
          <span className="text-[10px] bg-[var(--bg-tertiary)] px-2 py-1 rounded-md text-[var(--text-muted)]">
            {filteredCatalog.length} / {catalog.length}
          </span>
        </div>

        <div className="relative mb-3">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
          <input
            type="text"
            placeholder="Cerca nel catalogo..."
            value={catalogSearch}
            onChange={(e) => setCatalogSearch(e.target.value)}
            className="w-full bg-white border border-[var(--border)] rounded-lg pl-8 pr-3 py-2 text-xs outline-none focus:border-[var(--accent)] transition"
          />
        </div>

        <div className="max-h-52 overflow-y-auto">
          {catalog.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] italic text-center py-2">
              Il catalogo è vuoto. Clicca su "+ Aggiungi Riga Vuota" qui sotto.
            </p>
          ) : filteredCatalog.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] italic text-center py-2">
              Nessun risultato per "{catalogSearch}"
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {filteredCatalog.map(item => (
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleAddFromCatalog(item)}
                  key={item.id}
                  className="bg-white p-3 rounded-xl border border-[var(--border)] cursor-pointer hover:border-[var(--accent)] hover:shadow-sm transition group"
                >
                  <div className="flex justify-between items-start mb-1">
                    <p className="font-semibold text-xs text-[var(--text-primary)] group-hover:text-[var(--accent)] line-clamp-2 leading-tight uppercase">
                      {item.name || 'Senza Nome'}
                    </p>
                    <p className="text-sm font-bold text-[var(--text-primary)] ml-2 whitespace-nowrap">
                      €{item.price.toFixed(2)}
                    </p>
                  </div>
                  {item.details && (
                    <p className="text-[10px] text-gray-400 line-clamp-1 mt-0.5">{item.details}</p>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Righe Preventivo — Drag & Drop */}
      <div className="space-y-3">
        {services.length === 0 && (
          <p className="text-sm text-[var(--text-muted)] text-center py-4 italic">
            Nessun servizio nel preventivo.
          </p>
        )}

        <Reorder.Group axis="y" values={services} onReorder={onChange} className="space-y-3">
          {services.map((item) => {
            const isOmaggio = !!item.omaggio;
            const lineTotal = isOmaggio ? 0 : (item.qty * item.unitPrice) - (item.itemDiscount || 0);

            return (
              <Reorder.Item
                key={item.id}
                value={item}
                className={`flex flex-col gap-2 border p-3 rounded-xl group relative transition-shadow hover:shadow-md ${
                  isOmaggio
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-white border-[var(--border)]'
                }`}
              >
                {/* Riga principale */}
                <div className="flex items-center gap-2 w-full">
                  {/* Drag handle */}
                  <div className="cursor-grab active:cursor-grabbing px-1 text-gray-400 flex-shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/>
                      <circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>
                    </svg>
                  </div>

                  {/* Nome */}
                  <div className="flex-1">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateService(item.id, 'name', e.target.value)}
                      placeholder="Nome Servizio..."
                      className={inputClass + " font-bold uppercase text-xs" + (isOmaggio ? ' line-through text-emerald-600' : '')}
                    />
                  </div>

                  {/* Qty */}
                  <div className="w-14 flex-shrink-0">
                    <input
                      type="number" min="1"
                      value={item.qty}
                      onChange={(e) => updateService(item.id, 'qty', Number(e.target.value))}
                      disabled={isOmaggio}
                      className={inputClass + " text-center" + (isOmaggio ? ' opacity-40' : '')}
                      title="Quantità"
                    />
                  </div>

                  {/* Prezzo unitario */}
                  <div className="w-24 relative flex-shrink-0">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm">€</span>
                    <input
                      type="number" min="0" step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => updateService(item.id, 'unitPrice', Number(e.target.value))}
                      disabled={isOmaggio}
                      className={`${inputClass} pl-6 font-bold` + (isOmaggio ? ' opacity-40' : '')}
                      title="Prezzo unitario"
                    />
                  </div>

                  {/* Sconto per singolo item — nascosto se omaggio */}
                  {!isOmaggio && (
                    <div className="w-20 relative flex-shrink-0" title="Sconto su questa riga (€)">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-red-400 text-xs font-bold">-€</span>
                      <input
                        type="number" min="0" step="0.01"
                        value={item.itemDiscount || ''}
                        placeholder="0"
                        onChange={(e) => updateService(item.id, 'itemDiscount', Number(e.target.value))}
                        className={`${inputClass} pl-6 text-red-500 text-xs`}
                      />
                    </div>
                  )}

                  {/* Totale riga */}
                  <div className={`w-20 text-right text-xs font-bold whitespace-nowrap flex-shrink-0 ${
                    isOmaggio ? 'text-emerald-600' : 'text-[var(--text-primary)]'
                  }`}>
                    {isOmaggio ? 'OMAGGIO' : `€${lineTotal.toFixed(2)}`}
                  </div>

                  {/* Pulsante elimina */}
                  <button
                    onClick={() => removeService(item.id)}
                    className="w-7 h-7 flex flex-shrink-0 items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    ✕
                  </button>
                </div>

                {/* Dettagli e note */}
                <div className="pl-7 pr-8 w-full flex flex-col gap-1.5">
                  <textarea
                    value={item.details !== undefined ? item.details : ''}
                    onChange={(e) => updateService(item.id, 'details', e.target.value)}
                    placeholder="Dettagli del servizio (testo grigio nel PDF)..."
                    rows={1}
                    className={`${inputClass} resize-none text-xs text-gray-600`}
                  />
                  <textarea
                    value={item.notes || ''}
                    onChange={(e) => updateService(item.id, 'notes', e.target.value)}
                    placeholder="Note aggiuntive (testo blu nel PDF)..."
                    rows={1}
                    className={`${inputClass} resize-none text-xs text-blue-600`}
                  />
                </div>

                {/* Checkbox OMAGGIO — in basso a sinistra della card */}
                <div className="pl-7">
                  <label className={`inline-flex items-center gap-2 cursor-pointer select-none text-xs font-semibold rounded-lg px-2.5 py-1.5 transition ${
                    isOmaggio
                      ? 'text-emerald-700 bg-emerald-100'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}>
                    <input
                      type="checkbox"
                      checked={isOmaggio}
                      onChange={(e) => updateService(item.id, 'omaggio', e.target.checked)}
                      className="accent-emerald-600 w-3.5 h-3.5"
                    />
                    🎁 Omaggio (prezzo → €0,00 sul PDF)
                  </label>
                </div>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
      </div>

      <button
        onClick={handleAddCustom}
        className="w-full py-3 rounded-xl border-2 border-dashed border-[var(--border)] text-[var(--text-secondary)] font-medium hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition flex items-center justify-center gap-2 text-sm"
      >
        + Aggiungi Riga Vuota
      </button>
    </div>
  );
}