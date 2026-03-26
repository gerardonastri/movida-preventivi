import { useState } from 'react';
import { motion } from 'framer-motion';
import Toast from '../components/Toast';
import { getSettings, saveSettings } from '../utils/storage';
import type { CompanySettings } from '../utils/types';

export default function Settings() {
  const [settings, setSettings] = useState<CompanySettings>(getSettings());
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const handleChange = (field: keyof CompanySettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  // FIX PUNTO 7: Funzione per caricare il logo come Base64 (funziona offline)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings(prev => ({ ...prev, logoBase64: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    setIsSaving(true);
    // Fake loading state per dare la sensazione di "elaborazione"
    setTimeout(() => {
      saveSettings(settings);
      setIsSaving(false);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }, 600);
  };

  const inputClass = "w-full bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none transition border border-transparent focus:border-[var(--accent)]";
  const labelClass = "block text-sm font-medium text-[var(--text-secondary)] mb-1.5 ml-1";

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <header>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Impostazioni Azienda</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Questi dati verranno stampati sui preventivi in PDF.</p>
      </header>

      <div className="bg-white rounded-2xl p-6 shadow-[var(--shadow-card)] border border-[var(--border)] space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className={labelClass}>Nome Azienda</label>
            <input value={settings.name} onChange={(e) => handleChange('name', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input value={settings.email} onChange={(e) => handleChange('email', e.target.value)} className={inputClass} />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>Indirizzi (Legale / Logistica)</label>
            <input value={settings.address} onChange={(e) => handleChange('address', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Recapiti Telefonici</label>
            <input value={settings.phone} onChange={(e) => handleChange('phone', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Sito Web</label>
            <input value={settings.website} onChange={(e) => handleChange('website', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>P.IVA / Dati Fiscali</label>
            <input value={settings.vat} onChange={(e) => handleChange('vat', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>IBAN</label>
            <input value={settings.iban} onChange={(e) => handleChange('iban', e.target.value)} className={inputClass} />
          </div>
          
          {/* FIX PUNTO 7: Sezione Logo Aggiornata per Upload File (Base64) */}
          <div className="md:col-span-2 bg-[var(--bg-tertiary)] p-4 rounded-xl mt-2 border border-[var(--border)]">
            <label className={labelClass}>Logo Aziendale (Caricamento Offline)</label>
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleImageUpload} 
              className="text-sm mt-1" 
            />
            <p className="text-xs text-[var(--text-muted)] mt-2">
              Scegli un'immagine dal tuo PC. Verrà salvata in memoria e usata per il PDF (nessuna connessione internet richiesta).
            </p>
            {settings.logoBase64 && (
              <div className="mt-4">
                <p className="text-xs font-medium text-[var(--text-secondary)] mb-1">Anteprima:</p>
                <img 
                  src={settings.logoBase64} 
                  alt="Preview Logo" 
                  className="h-16 object-contain border border-[var(--border)] rounded p-1 bg-white" 
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-[var(--border)]">
          <motion.button 
            whileTap={{ scale: 0.97 }}
            onClick={handleSave}
            disabled={isSaving}
            className={`px-8 py-3 rounded-xl font-medium text-white shadow-[var(--shadow-card)] transition ${isSaving ? 'bg-gray-400' : 'bg-[var(--accent)] hover:shadow-[var(--shadow-hover)]'}`}
          >
            {isSaving ? 'Salvataggio...' : 'Salva Impostazioni'}
          </motion.button>
        </div>
      </div>

      <Toast message="Impostazioni salvate con successo!" isVisible={showToast} />
    </div>
  );
}