import type { ClientInfo } from '../utils/types';

interface ClientFormProps {
  data: ClientInfo;
  onChange: (data: ClientInfo) => void;
}

export default function ClientForm({ data, onChange }: ClientFormProps) {
  const handleChange = (field: keyof ClientInfo, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const inputClass = "w-full bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none transition border border-transparent focus:border-[var(--accent)]";
  const labelClass = "block text-sm font-medium text-[var(--text-secondary)] mb-1.5 ml-1";

  return (
    <div className="bg-white rounded-2xl p-6 shadow-(--shadow-card) border border-(--border)">
      <h2 className="text-lg font-semibold text-(--text-primary) mb-5 flex items-center gap-2">
        <span className="bg-(--accent-soft) text-(--accent) w-8 h-8 rounded-lg flex items-center justify-center">👤</span>
        Dati Cliente e Evento
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className={labelClass}>Richiesto da (Nome/Cognome)</label>
          <input 
            type="text" 
            value={data.name} 
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="es. Valentina Palladino"
            className={inputClass} 
          />
        </div>

        <div>
          <label className={labelClass}>Cellulare</label>
          <input 
            type="text" 
            value={data.phone} 
            onChange={(e) => handleChange('phone', e.target.value)}
            placeholder="es. 339.1234567"
            className={inputClass} 
          />
        </div>

        <div>
          <label className={labelClass}>Ricorrenza / Nome Festeggiato</label>
          <input 
            type="text" 
            value={data.eventType} 
            onChange={(e) => handleChange('eventType', e.target.value)}
            placeholder="es. COMPLEANNO - Bimba (Mia)"
            className={inputClass} 
          />
        </div>

        <div>
          <label className={labelClass}>Location</label>
          <input 
            type="text" 
            value={data.location} 
            onChange={(e) => handleChange('location', e.target.value)}
            placeholder="es. PARCO DEL MERCATELLO (SA)"
            className={inputClass} 
          />
        </div>

        <div>
          <label className={labelClass}>Data Evento</label>
          <input 
            type="date" 
            value={data.date} 
            onChange={(e) => handleChange('date', e.target.value)}
            className={inputClass} 
          />
        </div>

        <div>
          <label className={labelClass}>Orario (Dalle - Alle)</label>
          <input 
            type="text" 
            value={data.time} 
            onChange={(e) => handleChange('time', e.target.value)}
            placeholder="es. 17:00 - 20:00"
            className={inputClass} 
          />
        </div>
      </div>
    </div>
  );
}