import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSavedLocations, saveLocation, deleteLocation } from '../utils/storage';

export default function LocationsManager() {
  const [locations, setLocations] = useState<string[]>(getSavedLocations());
  const [searchTerm, setSearchTerm] = useState('');
  
  // Stati per l'Inline Editing (Stile Apple: modifica sul posto)
  const [editingLoc, setEditingLoc] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  
  // Rif. per gestire il focus automatico
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingLoc && inputRef.current) {
      inputRef.current.focus();
      // Posiziona il cursore alla fine del testo
      inputRef.current.selectionStart = inputRef.current.value.length;
    }
  }, [editingLoc]);

  // ── Azioni CRUD ────────────────────────────────────────────────────────────

  const handleAddNew = () => {
    const baseName = "NUOVA LOCATION";
    let newName = baseName;
    let counter = 1;
    
    // Evita duplicati istantanei se clicchi più volte
    while (locations.includes(newName)) {
      newName = `${baseName} ${counter}`;
      counter++;
    }

    saveLocation(newName);
    setLocations(getSavedLocations()); // Ricarica dallo storage per avere l'ordine corretto
    
    // Entra subito in modalità modifica per il nuovo elemento
    setEditingLoc(newName);
    setEditValue(newName);
    setSearchTerm(''); // Resetta la ricerca per assicurarsi di vederlo
  };

  const handleStartEdit = (loc: string) => {
    setEditingLoc(loc);
    setEditValue(loc);
  };

  const handleSaveEdit = (oldLoc: string) => {
    const normalizedNew = editValue.trim().toUpperCase();
    
    // Se non è cambiato o è vuoto, annulla la modifica
    if (normalizedNew === oldLoc || normalizedNew === '') {
      setEditingLoc(null);
      return;
    }

    // Se esiste già una location con questo nome, avvisa e annulla
    if (locations.includes(normalizedNew) && normalizedNew !== oldLoc) {
      alert("Questa location esiste già.");
      setEditingLoc(null);
      return;
    }

    // Esegui la modifica: elimina la vecchia e salva la nuova
    deleteLocation(oldLoc);
    saveLocation(normalizedNew);
    setLocations(getSavedLocations());
    setEditingLoc(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, oldLoc: string) => {
    if (e.key === 'Enter') handleSaveEdit(oldLoc);
    if (e.key === 'Escape') setEditingLoc(null);
  };

  const handleDelete = (loc: string) => {
    if (!confirm(`Sei sicuro di voler eliminare "${loc}"?`)) return;
    deleteLocation(loc);
    setLocations(getSavedLocations());
  };

  // ── Filtri ─────────────────────────────────────────────────────────────────

  const filteredLocations = useMemo(() => {
    if (!searchTerm.trim()) return locations;
    return locations.filter(loc => 
      loc.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [locations, searchTerm]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="pb-24">
      {/* Header Sticky con Effetto Glass (Stile iOS) */}
      <div className="sticky top-0 z-20 bg-[var(--bg-primary)]/80 backdrop-blur-lg pt-4 pb-4 -mx-4 px-4 md:mx-0 md:px-0 border-b border-[var(--border)] mb-6">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Luoghi Frequenti</h1>
            <p className="text-sm text-[var(--text-muted)] mt-0.5 font-medium">
              Gestisci l'autocompletamento delle tue location. · {locations.length}/50
            </p>
          </div>

          <div className="flex flex-wrap gap-2 md:gap-3 items-center">
            {/* Ricerca */}
            <div className="relative flex-1 md:flex-none md:w-56">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              <input
                type="text"
                placeholder="Cerca location…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-[var(--border)] rounded-xl pl-9 pr-4 py-2.5 text-sm shadow-sm outline-none focus:border-[var(--accent)] transition"
              />
            </div>

            {/* Nuovo item */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleAddNew}
              className="bg-[var(--accent)] text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-[0_4px_14px_rgba(37,99,235,0.25)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.3)] transition whitespace-nowrap flex items-center gap-2"
            >
              <span>+</span> Aggiungi
            </motion.button>
          </div>
        </header>
      </div>

      {/* Lista Location (Animata) */}
      <div className="max-w-3xl mx-auto">
        <div className="bg-white border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden">
          <AnimatePresence mode="popLayout">
            {filteredLocations.map((loc) => (
              <motion.div
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10, backgroundColor: '#fee2e2' }}
                transition={{ duration: 0.2 }}
                key={loc}
                className="group flex items-center justify-between border-b border-[var(--border)] last:border-b-0 px-4 py-3 hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                {/* Modalità Modifica vs Visualizzazione */}
                {editingLoc === loc ? (
                  <div className="flex-1 mr-4">
                    <input
                      ref={inputRef}
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => handleSaveEdit(loc)}
                      onKeyDown={(e) => handleKeyDown(e, loc)}
                      className="w-full bg-white border-2 border-[var(--accent)] rounded-lg px-3 py-1.5 text-sm font-bold text-[var(--text-primary)] outline-none shadow-[0_0_0_3px_rgba(37,99,235,0.1)]"
                    />
                    <p className="text-[10px] text-[var(--text-muted)] mt-1 ml-1 font-medium">Premi Invio per salvare, Esc per annullare</p>
                  </div>
                ) : (
                  <div 
                    className="flex-1 flex items-center gap-3 cursor-text"
                    onClick={() => handleStartEdit(loc)}
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center text-sm flex-shrink-0">
                      📍
                    </div>
                    <span className="font-bold text-sm text-[var(--text-primary)] select-none">
                      {loc}
                    </span>
                  </div>
                )}

                {/* Pulsante Elimina (Visibile all'hover su desktop, sempre su mobile) */}
                {editingLoc !== loc && (
                  <button
                    onClick={() => handleDelete(loc)}
                    className="md:opacity-0 md:group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all flex-shrink-0"
                    title="Elimina Location"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Empty State */}
          {filteredLocations.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-16 text-center flex flex-col items-center justify-center"
            >
              <span className="text-4xl mb-3 opacity-50">🗺️</span>
              <h3 className="text-lg font-bold text-[var(--text-primary)]">
                {searchTerm ? 'Nessuna location trovata' : 'Nessuna location salvata'}
              </h3>
              <p className="text-sm text-[var(--text-muted)] mt-1 max-w-sm">
                {searchTerm 
                  ? `Non ci sono risultati per "${searchTerm}".` 
                  : 'I luoghi che inserisci nei preventivi verranno salvati qui per l\'autocompletamento.'}
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}