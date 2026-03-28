import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getCatalogItems, saveCatalogItems } from '../utils/storage';
import type { CatalogItem } from '../utils/types';

export default function Catalog() {
  const [items, setItems] = useState<CatalogItem[]>(getCatalogItems());
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<string>('TUTTI');

  const updateItems = (newItems: CatalogItem[]) => {
    setItems(newItems);
    saveCatalogItems(newItems); 
  };

  const handleAddItem = () => {
    // Aggiunge un nuovo elemento con un tag base così entra subito in una categoria
    const newItem: CatalogItem = { id: crypto.randomUUID(), name: '[NUOVO] Nome Servizio', details: '', notes: '', price: 0 };
    updateItems([newItem, ...items]);
    setActiveTab('TUTTI'); // Riporta la vista su tutti per farlo vedere
  };

  const handleChange = (id: string, field: keyof CatalogItem, value: string | number) => {
    updateItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleDelete = (id: string) => {
    if (confirm("Vuoi eliminare questo servizio dal catalogo?")) {
      updateItems(items.filter(item => item.id !== id));
    }
  };

  const handleFactoryReset = () => {
    if (confirm("Attenzione: Questo cancellerà le tue modifiche e ricaricherà il catalogo base di Movida. Vuoi procedere?")) {
      localStorage.removeItem('preventivi_catalog');
      window.location.reload(); 
    }
  };

  // --- SMART FILTERS LOGIC (La Magia) ---
  // Estrae automaticamente tutte le parole tra parentesi quadre dai nomi dei servizi
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    items.forEach(item => {
      const match = item.name.match(/^\[(.*?)\]/);
      if (match) tags.add(match[1].toUpperCase());
      else tags.add('ALTRO'); // Per quelli senza tag
    });
    return Array.from(tags).sort();
  }, [items]);

  // Filtra per Ricerca Testuale e per Tab Attiva
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchTestuale = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            item.details.toLowerCase().includes(searchTerm.toLowerCase());
      
      const match = item.name.match(/^\[(.*?)\]/);
      const itemTag = match ? match[1].toUpperCase() : 'ALTRO';
      const matchTab = activeTab === 'TUTTI' || itemTag === activeTab;

      return matchTestuale && matchTab;
    });
  }, [items, searchTerm, activeTab]);

  const inputClass = "w-full bg-transparent text-[var(--text-primary)] rounded-lg px-3 py-2 outline-none transition hover:bg-[var(--bg-tertiary)] focus:bg-white focus:ring-2 focus:ring-[var(--accent)]";

  return (
    <div className="pb-24">
      {/* Header Sticky con Effetto Glass */}
      <div className="sticky top-0 z-20 bg-[var(--bg-primary)]/80 backdrop-blur-lg pt-4 pb-4 -mx-4 px-4 md:mx-0 md:px-0 border-b border-[var(--border)] mb-6">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Catalogo Servizi</h1>
            <p className="text-sm text-[var(--text-muted)] mt-0.5 font-medium">I tuoi pacchetti intelligenti per preventivi lampo.</p>
          </div>
          <div className="flex flex-wrap gap-2 md:gap-3">
            <div className="relative flex-1 md:flex-none">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              <input 
                type="text" 
                placeholder="Cerca un pacchetto..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="w-full bg-white border border-[var(--border)] rounded-xl pl-9 pr-4 py-2.5 text-sm shadow-sm outline-none focus:border-[var(--accent)] transition" 
              />
            </div>
            
            <motion.button 
              whileTap={{ scale: 0.95 }} 
              onClick={handleFactoryReset} 
              className="px-3 py-2.5 bg-[var(--bg-tertiary)] hover:bg-gray-200 text-[var(--text-secondary)] rounded-xl text-sm font-semibold transition"
              title="Ricarica il catalogo di fabbrica"
            >
              🔄
            </motion.button>

            <motion.button 
              whileTap={{ scale: 0.95 }} 
              onClick={handleAddItem} 
              className="bg-[var(--accent)] text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-[0_4px_14px_rgba(37,99,235,0.25)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.3)] transition whitespace-nowrap"
            >
              + Nuovo
            </motion.button>
          </div>
        </header>

        {/* Smart Filter Pills (Scorrevole su Mobile) */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide snap-x">
          <button 
            onClick={() => setActiveTab('TUTTI')}
            className={`snap-start whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all ${activeTab === 'TUTTI' ? 'bg-gray-900 text-white shadow-md' : 'bg-white text-gray-500 border border-[var(--border)] hover:bg-gray-50'}`}
          >
            TUTTI
          </button>
          {availableTags.map(tag => (
            <button 
              key={tag}
              onClick={() => setActiveTab(tag)}
              className={`snap-start whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all ${activeTab === tag ? 'bg-[var(--accent)] text-white shadow-[0_2px_10px_rgba(37,99,235,0.2)]' : 'bg-white text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--bg-tertiary)]'}`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Griglia Catalogo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
        <AnimatePresence>
          {filteredItems.map((item, index) => (
            <motion.div 
              layout 
              initial={{ opacity: 0, y: 15 }} 
              animate={{ opacity: 1, y: 0, transition: { delay: index * 0.05 } }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              key={item.id} 
              className="bg-white p-5 rounded-2xl shadow-sm border border-[var(--border)] hover:shadow-md transition-shadow group relative overflow-hidden"
            >
              <div className="flex flex-col gap-3">
                {/* Rigo Superiore: Nome e Prezzo */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <input 
                      type="text" 
                      placeholder="[TAG] Nome Servizio" 
                      value={item.name} 
                      onChange={(e) => handleChange(item.id, 'name', e.target.value)} 
                      className={`${inputClass} font-extrabold text-[15px] uppercase placeholder-gray-300 py-1.5`} 
                    />
                  </div>
                  <div className="w-28 relative flex-shrink-0">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-medium">€</span>
                    <input 
                      type="number" 
                      value={item.price} 
                      onChange={(e) => handleChange(item.id, 'price', Number(e.target.value))} 
                      className={`${inputClass} pl-8 font-black text-right text-base text-[var(--accent)] bg-blue-50/50`} 
                    />
                  </div>
                </div>
                
                {/* Rigo Inferiore: Dettagli e Note */}
                <div className="space-y-1 relative">
                  <textarea 
                    placeholder="Dettagli servizio (ciò che il cliente acquista, testo grigio in PDF)..." 
                    value={item.details} 
                    onChange={(e) => handleChange(item.id, 'details', e.target.value)} 
                    rows={2} 
                    className={`${inputClass} resize-none text-xs font-medium text-gray-600 leading-relaxed`} 
                  />
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                    <textarea 
                      placeholder="Note operative o vincoli (es. Max 28 bimbi, testo azzurro in PDF)..." 
                      value={item.notes} 
                      onChange={(e) => handleChange(item.id, 'notes', e.target.value)} 
                      rows={1} 
                      className={`${inputClass} pl-7 resize-none text-[11px] font-semibold text-blue-600/80 leading-snug`} 
                    />
                  </div>
                </div>
              </div>

              {/* Tasto Cancella (Stile Apple: Nascosto finché non fai hover su Desktop) */}
              <button 
                onClick={() => handleDelete(item.id)} 
                className="absolute top-4 right-4 md:opacity-0 md:group-hover:opacity-100 p-2 bg-white/80 backdrop-blur-sm text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all shadow-sm border border-transparent hover:border-red-100" 
                title="Elimina"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {filteredItems.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="col-span-full flex flex-col items-center justify-center py-16 text-center bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-3xl mt-4">
            <span className="text-4xl mb-3">👻</span>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">Nessun servizio trovato</h3>
            <p className="text-sm text-[var(--text-muted)] mt-1 max-w-sm">
              {activeTab !== 'TUTTI' ? `Non hai ancora servizi nella categoria ${activeTab}.` : 'Il tuo catalogo è vuoto. Clicca su "+ Nuovo" per iniziare a creare magia.'}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}