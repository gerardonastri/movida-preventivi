import { useState, useRef, useEffect } from 'react';
import type { ClientInfo } from '../utils/types';
import { getSavedLocations, saveLocation, deleteLocation } from '../utils/storage';

interface ClientFormProps {
  data: ClientInfo;
  onChange: (data: ClientInfo) => void;
  showErrors?: boolean;
}

export default function ClientForm({ data, onChange, showErrors = false }: ClientFormProps) {
  const [savedLocations, setSavedLocations] = useState<string[]>(getSavedLocations());
  const [showDropdown, setShowDropdown] = useState(false);
  const locationWrapRef = useRef<HTMLDivElement>(null);

  const handleChange = (field: keyof ClientInfo, value: string) => {
    onChange({ ...data, [field]: value });
  };

  // Chiude dropdown se si clicca fuori
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (locationWrapRef.current && !locationWrapRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtro in tempo reale: mostra le location che contengono il testo digitato
  const filteredLocations = savedLocations.filter(loc =>
    data.location === ''
      ? true
      : loc.toLowerCase().includes(data.location.toLowerCase())
  );

  const handleLocationInput = (value: string) => {
    handleChange('location', value);
    setShowDropdown(true);
  };

  const handleLocationFocus = () => {
    setShowDropdown(true);
  };

  const handleLocationSelect = (loc: string) => {
    handleChange('location', loc);
    setShowDropdown(false);
  };

  // Al blur, salva la location digitata in cronologia (con delay per permettere click sul dropdown)
  const handleLocationBlur = () => {
    setTimeout(() => {
      if (data.location.trim()) {
        saveLocation(data.location.trim());
        setSavedLocations(getSavedLocations());
      }
      setShowDropdown(false);
    }, 200);
  };

  const handleDeleteLocation = (loc: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    deleteLocation(loc);
    setSavedLocations(getSavedLocations());
  };

  const inputClass = (isError: boolean) =>
    `w-full bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none transition border ${
      isError ? 'border-red-500' : 'border-transparent focus:border-[var(--accent)]'
    }`;

  const labelClass = 'block text-sm font-medium text-[var(--text-secondary)] mb-1.5 ml-1';

  return (
    <div className="bg-white rounded-2xl p-6 shadow-[var(--shadow-card)] border border-[var(--border)]">
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-5 flex items-center gap-2">
        <span className="bg-[var(--accent-soft)] text-[var(--accent)] w-8 h-8 rounded-lg flex items-center justify-center">
          👤
        </span>
        Dati Cliente e Evento
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Nome */}
        <div>
          <label className={labelClass}>Richiesto da (Nome/Cognome) *</label>
          <input
            type="text"
            value={data.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="es. Valentina Palladino"
            className={inputClass(showErrors && !data.name.trim())}
          />
        </div>

        {/* Indirizzo */}
        <div>
          <label className={labelClass}>Indirizzo Cliente</label>
          <input
            type="text"
            value={data.address}
            onChange={(e) => handleChange('address', e.target.value)}
            placeholder="es. Via Roma 1, Salerno"
            className={inputClass(false)}
          />
        </div>

        {/* Cellulare */}
        <div>
          <label className={labelClass}>Cellulare</label>
          <input
            type="text"
            value={data.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            placeholder="es. 339.1234567"
            className={inputClass(false)}
          />
        </div>

        {/* Ricorrenza */}
        <div>
          <label className={labelClass}>Ricorrenza / Nome Festeggiato</label>
          <input
            type="text"
            value={data.eventType}
            onChange={(e) => handleChange('eventType', e.target.value)}
            placeholder="es. COMPLEANNO - Bimba (Mia)"
            className={inputClass(false)}
          />
        </div>

        {/* Location — input libero + dropdown cronologia */}
        <div ref={locationWrapRef} className="relative">
          <label className={labelClass}>
            Location
            {savedLocations.length > 0 && (
              <span className="ml-2 text-[10px] text-[var(--accent)] font-normal">
                {savedLocations.length} salvate
              </span>
            )}
          </label>

          <div className="relative">
            <input
              type="text"
              value={data.location}
              onChange={(e) => handleLocationInput(e.target.value)}
              onFocus={handleLocationFocus}
              onBlur={handleLocationBlur}
              placeholder="es. PARCO DEL MERCATELLO (SA)"
              className={inputClass(false)}
              autoComplete="off"
            />
            {/* Icona freccia per indicare che c'è un dropdown */}
            {savedLocations.length > 0 && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setShowDropdown(v => !v);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                tabIndex={-1}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            )}
          </div>

          {/* Dropdown */}
          {showDropdown && filteredLocations.length > 0 && (
            <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-[var(--border)] rounded-xl shadow-xl overflow-hidden">
              <div className="max-h-44 overflow-y-auto">
                {filteredLocations.map((loc) => (
                  <div
                    key={loc}
                    onMouseDown={() => handleLocationSelect(loc)}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-[var(--bg-tertiary)] cursor-pointer group"
                  >
                    <span className="text-sm text-[var(--text-primary)] truncate">
                      <span className="mr-2 text-[var(--text-muted)]">📍</span>
                      {loc}
                    </span>
                    <button
                      onMouseDown={(e) => handleDeleteLocation(loc, e)}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 ml-2 transition rounded p-0.5"
                      title="Rimuovi dalla cronologia"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              {/* Footer info */}
              <div className="px-4 py-2 border-t border-[var(--border)] bg-[var(--bg-tertiary)]">
                <p className="text-[10px] text-[var(--text-muted)]">
                  Le location vengono salvate automaticamente
                </p>
              </div>
            </div>
          )}

          {/* Messaggio quando non ci sono corrispondenze ma ci sono location salvate */}
          {showDropdown && filteredLocations.length === 0 && savedLocations.length > 0 && data.location !== '' && (
            <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-[var(--border)] rounded-xl shadow-xl px-4 py-3">
              <p className="text-xs text-[var(--text-muted)]">Nessuna location salvata corrisponde. Premi Invio per usare questo testo.</p>
            </div>
          )}
        </div>

        {/* Data Evento */}
        <div>
          <label className={labelClass}>Data Evento *</label>
          <input
            type="date"
            value={data.date}
            onChange={(e) => handleChange('date', e.target.value)}
            className={inputClass(showErrors && !data.date)}
          />
        </div>

        {/* Orario */}
        <div className="md:col-span-2">
          <label className={labelClass}>Orario (Dalle - Alle)</label>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="time"
              value={data.timeFrom}
              onChange={(e) => handleChange('timeFrom', e.target.value)}
              className={inputClass(false)}
            />
            <input
              type="time"
              value={data.timeTo}
              onChange={(e) => handleChange('timeTo', e.target.value)}
              className={inputClass(false)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}