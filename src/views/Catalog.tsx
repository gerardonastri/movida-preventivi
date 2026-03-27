import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getCatalogItems, saveCatalogItems } from '../utils/storage';
import type { CatalogItem } from '../utils/types';

export default function Catalog() {
  const [items, setItems] = useState<CatalogItem[]>(getCatalogItems());
  const [searchTerm, setSearchTerm] = useState('');

  const updateItems = (newItems: CatalogItem[]) => {
    setItems(newItems);
    saveCatalogItems(newItems); // Salva istantaneamente in locale
  };

  const handleAddItem = () => {
    const newItem: CatalogItem = { id: crypto.randomUUID(), name: '', details: '', notes: '', price: 0 };
    updateItems([newItem, ...items]);
  };

  const handleChange = (id: string, field: keyof CatalogItem, value: any) => {
    updateItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleDelete = (id: string) => {
    if (confirm("Vuoi eliminare questo servizio dal catalogo?")) {
      updateItems(items.filter(item => item.id !== id));
    }
  };

  const filteredItems = items.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const inputClass = "w-full bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg px-3 py-2 text-sm outline-none transition border border-transparent focus:border-[var(--accent)]";

  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Catalogo Servizi</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Gestisci i pacchetti predefiniti per velocizzare i preventivi.</p>
        </div>
        <div className="flex gap-3">
          <input type="text" placeholder="🔍 Cerca pacchetto..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-white border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm shadow-sm outline-none focus:border-[var(--accent)]" />
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleAddItem} className="bg-[var(--accent)] text-white px-5 py-2.5 rounded-xl font-medium shadow-sm hover:shadow-md transition whitespace-nowrap">
            + Nuovo Servizio
          </motion.button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence>
          {filteredItems.map(item => (
            <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} key={item.id} className="bg-white p-5 rounded-2xl shadow-[var(--shadow-card)] border border-[var(--border)] group">
              <div className="flex flex-col md:flex-row gap-4">
                
                <div className="flex-1 space-y-3">
                  <div className="flex gap-3">
                    <input type="text" placeholder="Nome Pacchetto (es. ANIMAZIONE CON 4 ANIMATORI)" value={item.name} onChange={(e) => handleChange(item.id, 'name', e.target.value)} className={`${inputClass} font-bold text-base`} />
                    <div className="w-32 relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">€</span>
                      <input type="number" value={item.price} onChange={(e) => handleChange(item.id, 'price', Number(e.target.value))} className={`${inputClass} pl-7 font-bold`} />
                    </div>
                  </div>
                  
                  <textarea placeholder="Dettagli servizio (Testo grigio nel PDF)..." value={item.details} onChange={(e) => handleChange(item.id, 'details', e.target.value)} rows={2} className={`${inputClass} resize-none text-xs`} />
                  <textarea placeholder="Note extra (Testo azzurro/grigio nel PDF)..." value={item.notes} onChange={(e) => handleChange(item.id, 'notes', e.target.value)} rows={1} className={`${inputClass} resize-none text-xs text-blue-600`} />
                </div>

                <div className="flex items-start md:border-l border-[var(--border)] md:pl-4">
                  <button onClick={() => handleDelete(item.id)} className="p-2 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Elimina dal catalogo">🗑️</button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {filteredItems.length === 0 && (
          <div className="text-center py-12 text-[var(--text-muted)] border-2 border-dashed border-[var(--border)] rounded-2xl">
            Nessun servizio trovato. Clicca "+ Nuovo Servizio" per iniziare.
          </div>
        )}
      </div>
    </div>
  );
}