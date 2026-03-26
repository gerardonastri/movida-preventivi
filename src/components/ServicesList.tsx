import { useState } from 'react';
import { motion, Reorder } from 'framer-motion';
import type { QuoteService, ServiceCategory } from '../utils/types';
import servicesData from '../data/services.json';

const catalog = servicesData as ServiceCategory[];

interface ServicesListProps {
  services: QuoteService[];
  onChange: (services: QuoteService[]) => void;
}

export default function ServicesList({ services, onChange }: ServicesListProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>(catalog[0]?.category || '');

  const handleAddPackage = (pkg: ServiceCategory['packages'][0]) => {
    const newServices = pkg.items.map(item => ({
      id: crypto.randomUUID(),
      name: item.name,
      description: item.description || '',
      qty: item.qty,
      unitPrice: item.price
    }));
    onChange([...services, ...newServices]);
  };

  const handleAddCustom = () => {
    onChange([...services, { id: crypto.randomUUID(), name: '', description: '', qty: 1, unitPrice: 0 }]);
  };

  const updateService = (id: string, field: keyof QuoteService, value: string | number) => {
    onChange(services.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const removeService = (id: string) => {
    onChange(services.filter(s => s.id !== id));
  };

  const inputClass = "w-full bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none transition border border-transparent focus:border-[var(--accent)]";

  return (
    <div className="bg-white rounded-2xl p-6 shadow-[var(--shadow-card)] border border-[var(--border)] space-y-6">
      <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
        <span className="bg-[var(--accent-soft)] text-[var(--accent)] w-8 h-8 rounded-lg flex items-center justify-center">📦</span>
        Servizi e Pacchetti
      </h2>

      {/* Selettore Pacchetti */}
      <div className="bg-[var(--bg-primary)] p-4 rounded-xl border border-[var(--border)]">
        <div className="flex gap-2 mb-3 overflow-x-auto pb-2 scrollbar-hide">
          {catalog.map(cat => (
            <button key={cat.category} onClick={() => setSelectedCategory(cat.category)} className={`px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${selectedCategory === cat.category ? 'bg-[var(--accent)] text-white shadow-sm' : 'bg-white text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`}>
              {cat.category}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {catalog.find(c => c.category === selectedCategory)?.packages.map(pkg => (
            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={() => handleAddPackage(pkg)} key={pkg.name} className="bg-white p-3 rounded-xl border border-[var(--border)] cursor-pointer hover:border-[var(--accent)] hover:shadow-sm transition group">
              <div className="flex justify-between items-center mb-1">
                <p className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">{pkg.name}</p>
                <p className="text-sm font-bold text-[var(--text-primary)]">€{pkg.price}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Lista Servizi con Drag & Drop */}
      <div className="space-y-3">
        {services.length === 0 && (
          <p className="text-sm text-[var(--text-muted)] text-center py-4 italic">Nessun servizio aggiunto.</p>
        )}
        <Reorder.Group axis="y" values={services} onReorder={onChange} className="space-y-3">
          {services.map((item) => (
            <Reorder.Item key={item.id} value={item} className="flex flex-col gap-2 bg-white border border-[var(--border)] p-3 rounded-xl group relative hover:shadow-md transition-shadow">
              
              <div className="flex items-center gap-2 md:gap-3 w-full">
                <div className="cursor-grab active:cursor-grabbing px-1 text-gray-400 hover:text-gray-600">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
                </div>
                
                <div className="flex-1">
                  <input type="text" value={item.name} onChange={(e) => updateService(item.id, 'name', e.target.value)} placeholder="Nome Servizio..." className={inputClass + " font-semibold"} />
                </div>
                <div className="w-16 md:w-20">
                  <input type="number" min="1" value={item.qty} onChange={(e) => updateService(item.id, 'qty', Number(e.target.value))} className={inputClass} />
                </div>
                <div className="w-24 md:w-28 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm">€</span>
                  <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => updateService(item.id, 'unitPrice', Number(e.target.value))} className={`${inputClass} pl-7`} />
                </div>
                <button onClick={() => removeService(item.id)} className="w-10 h-10 flex flex-shrink-0 items-center justify-center text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                  🗑️
                </button>
              </div>
              
              {/* Box Descrizione Aggiuntiva */}
              <div className="pl-8 pr-12 w-full">
                <textarea 
                  value={item.description} 
                  onChange={(e) => updateService(item.id, 'description', e.target.value)} 
                  placeholder="Note o descrizioni aggiuntive..." 
                  rows={2}
                  className="w-full bg-[var(--bg-primary)] text-[var(--text-secondary)] rounded-lg px-3 py-2 text-xs outline-none transition border border-transparent focus:border-[var(--accent)] resize-none" 
                />
              </div>

            </Reorder.Item>
          ))}
        </Reorder.Group>
      </div>

      <button onClick={handleAddCustom} className="w-full py-3 rounded-xl border-2 border-dashed border-[var(--border)] text-[var(--text-secondary)] font-medium hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition flex items-center justify-center gap-2">
        <span>+</span> Aggiungi Servizio Manuale
      </button>
    </div>
  );
}