import { useState, useMemo } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { getCatalogItems } from '../utils/storage';
import type { QuoteService, CatalogItem } from '../utils/types';

interface ServicesListProps {
  services: QuoteService[];
  onChange: (services: QuoteService[]) => void;
}

export default function ServicesList({ services, onChange }: ServicesListProps) {
  const [catalog] = useState<CatalogItem[]>(getCatalogItems());
  const [catalogSearch, setCatalogSearch] = useState('');
  
  // Stato per l'accordion (albero categorie)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // 1. Filtra il catalogo in base alla ricerca
  const filteredCatalog = useMemo(() => {
    return catalog.filter(item =>
      item.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      (item.details && item.details.toLowerCase().includes(catalogSearch.toLowerCase()))
    );
  }, [catalog, catalogSearch]);

  // 2. Raggruppa gli elementi leggendo le parentesi quadre nel nome [Gruppo]
  const groupedCatalog = useMemo(() => {
    return filteredCatalog.reduce((acc, item) => {
      // Cerca qualcosa tra parentesi quadre, es: "[Allestimenti] Arco palloncini"
      const match = item.name.match(/\[([^\]]+)\]/);
      
      // Se trova le parentesi quadre usa il testo all'interno, altrimenti "Altri Servizi"
      const cat = match ? match[1].trim() : 'Altri Servizi';
      
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {} as Record<string, CatalogItem[]>);
  }, [filteredCatalog]);

  const hasSearch = catalogSearch.trim() !== '';

  const toggleGroup = (groupName: string) => {
    setOpenGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  const handleAddFromCatalog = (item: CatalogItem) => {
    const newService: QuoteService = {
      id: crypto.randomUUID(),
      name: item.name, // Mantiene il nome originale completo per il preventivo
      details: item.details || '',
      notes: item.notes || '',
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
    <div className="bg-white rounded-3xl p-6 md:p-8 shadow-[var(--shadow-card)] border border-[var(--border)] space-y-8">
      
      {/* HEADER */}
      <h2 className="text-xl font-semibold text-[var(--text-primary)] flex items-center gap-3">
        <span className="bg-[var(--accent-soft)] text-[var(--accent)] w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm">
          📦
        </span>
        Servizi e Pacchetti
      </h2>

      {/* ─── SEZIONE 1: CATALOGO AD ALBERO ─── */}
      <div className="bg-[var(--bg-primary)] p-5 rounded-2xl border border-[var(--border)]">
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider ml-1">
            Catalogo Servizi
          </p>
          <span className="text-[11px] font-bold bg-[var(--bg-tertiary)] px-2.5 py-1 rounded-full text-[var(--text-muted)]">
            {filteredCatalog.length} / {catalog.length}
          </span>
        </div>

        {/* Barra di ricerca */}
        <div className="relative mb-4">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Cerca un pacchetto o servizio..."
            value={catalogSearch}
            onChange={(e) => setCatalogSearch(e.target.value)}
            className="w-full bg-white border border-[var(--border)] rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all shadow-sm"
          />
        </div>

        <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
          {catalog.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] italic text-center py-6">
              Il catalogo è vuoto. Aggiungi i servizi dalle impostazioni.
            </p>
          ) : Object.keys(groupedCatalog).length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] italic text-center py-6">
              Nessun risultato per "{catalogSearch}"
            </p>
          ) : (
            // Render dei gruppi creati dalle parentesi quadre
            Object.entries(groupedCatalog).map(([groupName, items]) => {
              const isOpen = hasSearch || !!openGroups[groupName];

              return (
                <div 
                  key={groupName} 
                  className="bg-white rounded-2xl overflow-hidden border border-[var(--border)] shadow-sm transition-colors duration-300"
                >
                  {/* Header Gruppo */}
                  <button
                    onClick={() => toggleGroup(groupName)}
                    className="w-full flex items-center justify-between px-4 py-3.5 text-left outline-none hover:bg-[var(--bg-tertiary)] transition-colors"
                  >
                    <span className="font-semibold text-[var(--text-primary)] text-[14px]">
                      {groupName} <span className="text-gray-400 font-normal ml-1 text-xs">({items.length})</span>
                    </span>
                    <motion.div
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ type: "spring", stiffness: 260, damping: 20 }}
                      className="w-7 h-7 flex items-center justify-center bg-[var(--bg-tertiary)] rounded-full text-gray-500"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </motion.div>
                  </button>

                  {/* Elementi del Gruppo */}
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                      >
                        <div className="px-3 pb-3 space-y-1.5 border-t border-[var(--border)] pt-2 bg-[var(--bg-primary)]">
                          {items.map(item => {
                            // UI PULITA: Rimuove il tag [Gruppo] dal nome visualizzato nel menu a tendina
                            const displayName = item.name.replace(/\[.*?\]\s*/, '');
                            
                            return (
                              <div
                                key={item.id}
                                className="flex justify-between items-center bg-white p-3 rounded-xl border border-[var(--border)] hover:border-[var(--accent)] hover:shadow-sm transition group cursor-pointer"
                                onClick={() => handleAddFromCatalog(item)}
                              >
                                <div>
                                  <p className="font-semibold text-xs text-[var(--text-primary)] group-hover:text-[var(--accent)] line-clamp-1 uppercase transition-colors">
                                    {displayName || 'Senza Nome'}
                                  </p>
                                  {item.details && (
                                    <p className="text-[10px] text-gray-400 line-clamp-1 mt-0.5">{item.details}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 pl-2">
                                  <p className="text-sm font-bold text-[var(--text-primary)] whitespace-nowrap">
                                    €{item.price.toFixed(2)}
                                  </p>
                                  <button className="w-7 h-7 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--accent)] font-bold group-hover:bg-[var(--accent)] group-hover:text-white transition-colors duration-200">
                                    +
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ─── SEZIONE 2: PREVENTIVO (Drag & Drop Mantenuto) ─── */}
      <div className="border-t border-[var(--border)] pt-8">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider ml-1">
            Servizi nel Preventivo
          </h3>
          <span className="bg-gray-100 text-gray-500 py-1 px-3 rounded-full text-xs font-bold shadow-inner">
            {services.length}
          </span>
        </div>

        {services.length === 0 && (
          <div className="text-center py-10 bg-gray-50 border border-dashed border-gray-200 rounded-2xl mb-4">
            <p className="text-gray-400 text-sm">Nessun servizio aggiunto.<br/>Selezionali dal catalogo qui sopra.</p>
          </div>
        )}

        <Reorder.Group axis="y" values={services} onReorder={onChange} className="space-y-4">
          {services.map((item) => {
            const isOmaggio = !!item.omaggio;
            const lineTotal = isOmaggio ? 0 : (item.qty * item.unitPrice) - (item.itemDiscount || 0);

            return (
              <Reorder.Item
                key={item.id}
                value={item}
                className={`flex flex-col gap-3 border p-4 rounded-2xl group relative transition-shadow hover:shadow-md bg-white ${
                  isOmaggio ? 'border-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'border-[var(--border)]'
                }`}
              >
                {/* Riga principale */}
                <div className="flex items-center gap-3 w-full">
                  {/* Drag handle */}
                  <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="5" r="1.5"/><circle cx="9" cy="19" r="1.5"/>
                      <circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
                    </svg>
                  </div>

                  {/* Nome */}
                  <div className="flex-1">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateService(item.id, 'name', e.target.value)}
                      placeholder="Nome Servizio..."
                      className={`${inputClass} font-bold uppercase text-[13px] ${isOmaggio ? 'line-through text-emerald-600 bg-emerald-50/50' : ''}`}
                    />
                  </div>

                  {/* Qty */}
                  <div className="w-16 flex-shrink-0">
                    <input
                      type="number" min="1"
                      value={item.qty}
                      onChange={(e) => updateService(item.id, 'qty', Number(e.target.value))}
                      disabled={isOmaggio}
                      className={`${inputClass} text-center font-medium ${isOmaggio ? 'opacity-40 bg-emerald-50/50' : ''}`}
                      title="Quantità"
                    />
                  </div>

                  {/* Prezzo unitario */}
                  <div className="w-24 relative flex-shrink-0">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm">€</span>
                    <input
                      type="number" min="0" step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => updateService(item.id, 'unitPrice', Number(e.target.value))}
                      disabled={isOmaggio}
                      className={`${inputClass} pl-7 font-bold ${isOmaggio ? 'opacity-40 bg-emerald-50/50' : ''}`}
                      title="Prezzo unitario"
                    />
                  </div>

                  {/* Sconto singolo */}
                  {!isOmaggio && (
                    <div className="w-20 relative flex-shrink-0" title="Sconto su questa riga (€)">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-red-400 text-xs font-bold">-€</span>
                      <input
                        type="number" min="0" step="0.01"
                        value={item.itemDiscount || ''}
                        placeholder="0"
                        onChange={(e) => updateService(item.id, 'itemDiscount', Number(e.target.value))}
                        className={`${inputClass} pl-7 text-red-500 font-medium`}
                      />
                    </div>
                  )}

                  {/* Totale riga */}
                  <div className={`w-20 text-right text-sm font-bold whitespace-nowrap flex-shrink-0 ${
                    isOmaggio ? 'text-emerald-500' : 'text-[var(--text-primary)]'
                  }`}>
                    {isOmaggio ? 'OMAGGIO' : `€${lineTotal.toFixed(2)}`}
                  </div>

                  {/* Pulsante elimina */}
                  <button
                    onClick={() => removeService(item.id)}
                    className="w-8 h-8 flex flex-shrink-0 items-center justify-center text-red-400 hover:text-white hover:bg-red-500 rounded-full transition-all"
                    title="Rimuovi"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </button>
                </div>

                {/* Dettagli e note */}
                <div className="pl-9 pr-10 w-full flex flex-col gap-2">
                  <textarea
                    value={item.details !== undefined ? item.details : ''}
                    onChange={(e) => updateService(item.id, 'details', e.target.value)}
                    placeholder="Dettagli del servizio (verranno stampati nel PDF in grigio)..."
                    rows={1}
                    className={`${inputClass} resize-none text-xs text-gray-500 ${isOmaggio ? 'bg-emerald-50/30' : ''}`}
                  />
                  <textarea
                    value={item.notes || ''}
                    onChange={(e) => updateService(item.id, 'notes', e.target.value)}
                    placeholder="Note aggiuntive interne (testo blu)..."
                    rows={1}
                    className={`${inputClass} resize-none text-xs text-blue-500 ${isOmaggio ? 'bg-emerald-50/30' : ''}`}
                  />
                </div>

                {/* Checkbox OMAGGIO */}
                <div className="pl-9 mt-1">
                  <label className={`inline-flex items-center gap-2.5 cursor-pointer select-none text-[13px] font-semibold rounded-xl px-3 py-2 transition-all ${
                    isOmaggio
                      ? 'text-emerald-700 bg-emerald-100 shadow-sm'
                      : 'text-gray-400 hover:bg-gray-100'
                  }`}>
                    <input
                      type="checkbox"
                      checked={isOmaggio}
                      onChange={(e) => updateService(item.id, 'omaggio', e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    🎁 Segna come Omaggio (Prezzo €0 nel PDF)
                  </label>
                </div>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>

        <button
          onClick={handleAddCustom}
          className="mt-4 w-full py-3.5 rounded-2xl border-2 border-dashed border-[var(--border)] text-[var(--text-secondary)] font-semibold hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] hover:border-gray-300 transition-all flex items-center justify-center gap-2 text-sm"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Aggiungi Riga Personalizzata Vuota
        </button>
      </div>
    </div>
  );
}