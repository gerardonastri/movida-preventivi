import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import Toast from '../components/Toast';
import { getSettings, saveSettings, getQuotes } from '../utils/storage';
import type { CompanySettings } from '../utils/types';
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';

// Interfacce per html2pdf per evitare errori TypeScript
interface Html2PdfOptions {
  margin: number;
  filename: string;
  image: { type: string; quality: number };
  html2canvas: { scale: number; useCORS: boolean; backgroundColor: string };
  jsPDF: { unit: string; format: string; orientation: string };
}
interface Html2PdfInstance {
  set: (options: Html2PdfOptions) => Html2PdfInstance;
  from: (element: HTMLElement) => Html2PdfInstance;
  save: () => Promise<void>;
}
interface Html2PdfStatic {
  (): Html2PdfInstance;
}

export default function Settings() {
  const [settings, setSettings] = useState<CompanySettings>(getSettings());
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  const [toastConfig, setToastConfig] = useState({ visible: false, message: '', type: 'success' as 'success'|'info' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToastConfig({ visible: true, message, type });
    setTimeout(() => setToastConfig(prev => ({ ...prev, visible: false })), 3000);
  };

  const handleChange = (field: keyof CompanySettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

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
    setTimeout(() => {
      saveSettings(settings);
      setIsSaving(false);
      showToast("Impostazioni salvate con successo!");
    }, 600);
  };

  // --- 1. BACKUP JSON (Ripristinabile) ---
  const handleExportJson = () => {
    try {
      const backupData = {
        quotes: localStorage.getItem('preventivi_quotes'),
        counter: localStorage.getItem('preventivi_counter'),
        settings: localStorage.getItem('preventivi_settings')
      };
      const blob = new Blob([JSON.stringify(backupData)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `Movida_Backup_Sistema_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Backup JSON scaricato con successo!");
    } catch (error) {
      console.error(error);
      alert("Errore durante la generazione del backup JSON.");
    }
  };

  // --- 2. EXPORT EXCEL (Per analisi e commercialista) ---
  const handleExportExcel = () => {
    try {
      const quotes = getQuotes();
      if (quotes.length === 0) {
        showToast("Nessun preventivo da esportare", "info");
        return;
      }

      // Mappiamo i dati per avere colonne pulite su Excel
      const excelData = quotes.map(q => {
        const subtotal = q.services.reduce((acc, s) => acc + (s.qty * s.unitPrice), 0);
        const total = subtotal - q.discount;
        
        return {
          "ID Documento": q.id,
          "Tipo": q.documentType.toUpperCase(),
          "Data Creazione": new Date(q.createdAt).toLocaleDateString('it-IT'),
          "Nome Cliente": q.client.name,
          "Telefono": q.client.phone,
          "Evento": q.client.eventType,
          "Data Evento": q.client.date,
          "Location": q.client.location,
          "Metodo Pagamento": q.paymentMethod.toUpperCase(),
          "Subtotale (€)": subtotal,
          "Sconto (€)": q.discount,
          "Totale Finale (€)": total
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Archivio Preventivi");
      
      XLSX.writeFile(workbook, `Movida_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
      showToast("Report Excel scaricato!");
    } catch (error) {
      console.error(error);
      alert("Errore durante la generazione dell'Excel.");
    }
  };

  // --- 3. EXPORT PDF (Report Visivo) ---
  const handleExportPdf = () => {
    const quotes = getQuotes();
    if (quotes.length === 0) {
      showToast("Nessun preventivo da esportare", "info");
      return;
    }

    setIsGeneratingPdf(true);

    setTimeout(() => {
      const element = document.getElementById('pdf-backup-container');
      if (!element) {
        setIsGeneratingPdf(false);
        return;
      }

      const opt = {
        margin: 10,
        filename: `Movida_Report_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' as const } // Landscape per tabelle larghe
      };

      (html2pdf as unknown as Html2PdfStatic)().set(opt).from(element).save().then(() => {
        setIsGeneratingPdf(false);
        showToast("Report PDF generato con successo!");
      }).catch((err: Error) => {
        console.error(err);
        setIsGeneratingPdf(false);
        showToast("Errore PDF.", "info");
      });
    }, 300);
  };

  // --- LOGICA DI RIPRISTINO (IMPORT) ---
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (confirm("Attenzione: Importare un backup JSON sovrascriverà tutti i preventivi e le impostazioni attuali. Procedere?")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          
          if (data.quotes) localStorage.setItem('preventivi_quotes', data.quotes);
          if (data.counter) localStorage.setItem('preventivi_counter', data.counter);
          if (data.settings) {
            localStorage.setItem('preventivi_settings', data.settings);
            setSettings(JSON.parse(data.settings)); 
          }

          showToast("Backup ripristinato! Riavvio in corso...");
          setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
          console.error(error);
          alert("Errore: Il file selezionato non è un backup JSON valido.");
        }
      };
      reader.readAsText(file);
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const inputClass = "w-full bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none transition border border-transparent focus:border-[var(--accent)]";
  const labelClass = "block text-sm font-medium text-[var(--text-secondary)] mb-1.5 ml-1";

  // Dati per la vista nascosta del PDF
  const allQuotes = getQuotes();

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12 relative">
      <header>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Impostazioni Azienda</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Questi dati verranno stampati sui preventivi in PDF.</p>
      </header>

      {/* Form Impostazioni */}
      <div className="bg-white rounded-2xl p-6 shadow-[var(--shadow-card)] border border-[var(--border)] space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div><label className={labelClass}>Nome Azienda</label><input value={settings.name} onChange={(e) => handleChange('name', e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>Email</label><input value={settings.email} onChange={(e) => handleChange('email', e.target.value)} className={inputClass} /></div>
          <div className="md:col-span-2"><label className={labelClass}>Indirizzi (Legale / Logistica)</label><input value={settings.address} onChange={(e) => handleChange('address', e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>Recapiti Telefonici</label><input value={settings.phone} onChange={(e) => handleChange('phone', e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>Sito Web</label><input value={settings.website} onChange={(e) => handleChange('website', e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>P.IVA / Dati Fiscali</label><input value={settings.vat} onChange={(e) => handleChange('vat', e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>IBAN</label><input value={settings.iban} onChange={(e) => handleChange('iban', e.target.value)} className={inputClass} /></div>
          
          <div className="md:col-span-2 bg-[var(--bg-tertiary)] p-4 rounded-xl mt-2 border border-[var(--border)]">
            <label className={labelClass}>Logo Aziendale (Caricamento Offline)</label>
            <input type="file" accept="image/*" onChange={handleImageUpload} className="text-sm mt-1" />
            <p className="text-xs text-[var(--text-muted)] mt-2">Scegli un'immagine dal tuo PC. Verrà salvata in memoria e usata per il PDF.</p>
            {settings.logoBase64 && (
              <div className="mt-4"><p className="text-xs font-medium text-[var(--text-secondary)] mb-1">Anteprima:</p><img src={settings.logoBase64} alt="Preview Logo" className="h-16 object-contain border border-[var(--border)] rounded p-1 bg-white" /></div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-[var(--border)]">
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleSave} disabled={isSaving} className={`px-8 py-3 rounded-xl font-medium text-white shadow-[var(--shadow-card)] transition ${isSaving ? 'bg-gray-400' : 'bg-[var(--accent)] hover:shadow-[var(--shadow-hover)]'}`}>
            {isSaving ? 'Salvataggio...' : 'Salva Impostazioni'}
          </motion.button>
        </div>
      </div>

      {/* SEZIONE: GESTIONE DATI ED EXPORT MULTIPLO */}
      <div className="bg-white rounded-2xl p-6 shadow-[var(--shadow-card)] border border-[var(--border)] space-y-4 mt-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="bg-blue-100 text-blue-600 w-10 h-10 rounded-xl flex items-center justify-center text-xl">💾</span>
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Esportazione e Backup Dati</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">Scarica i tuoi preventivi in vari formati o esegui un backup completo del sistema.</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-[var(--border)]">
          {/* Pulsante JSON */}
          <div className="flex flex-col gap-2">
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleExportJson} className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-medium transition flex items-center justify-center gap-2 border border-gray-300">
              ⚙️ Backup JSON
            </motion.button>
            <p className="text-[10px] text-center text-[var(--text-muted)]">Copia di sistema. Usa questo per ripristinare i dati.</p>
          </div>

          {/* Pulsante Excel */}
          <div className="flex flex-col gap-2">
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleExportExcel} className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-medium transition flex items-center justify-center gap-2 border border-emerald-200">
              📊 Export Excel
            </motion.button>
            <p className="text-[10px] text-center text-[var(--text-muted)]">Per contabilità e analisi dati.</p>
          </div>

          {/* Pulsante PDF */}
          <div className="flex flex-col gap-2">
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleExportPdf} disabled={isGeneratingPdf} className={`w-full py-2.5 rounded-xl font-medium transition flex items-center justify-center gap-2 border ${isGeneratingPdf ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'}`}>
              {isGeneratingPdf ? '⏳...' : '📄 Stampa Report PDF'}
            </motion.button>
            <p className="text-[10px] text-center text-[var(--text-muted)]">Tabella riassuntiva pronta da stampare.</p>
          </div>
        </div>

        {/* Zona Ripristino separata */}
        <div className="pt-4 mt-2 border-t border-[var(--border)] flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[var(--text-secondary)]">Hai cambiato dispositivo? Ripristina un backup JSON salvato in precedenza.</p>
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => fileInputRef.current?.click()} className="whitespace-nowrap px-6 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border)] text-[var(--text-primary)] rounded-xl font-medium transition flex items-center gap-2 text-sm">
            ⬆️ Ripristina da JSON
          </motion.button>
          <input type="file" accept=".json" ref={fileInputRef} onChange={handleImportBackup} className="hidden" />
        </div>
      </div>

      <Toast message={toastConfig.message} isVisible={toastConfig.visible} type={toastConfig.type as 'success' | 'info'} />

      {/* TEMPLATE PDF NASCOSTO PER IL REPORT GENERALE */}
      <div style={{ position: 'absolute', top: '-10000px', left: '-10000px', width: '297mm' }}>
        <div id="pdf-backup-container" style={{ padding: '20px', backgroundColor: '#fff', color: '#000', fontFamily: 'Arial, sans-serif' }}>
          <h1 style={{ textAlign: 'center', color: '#1e3a8a', marginBottom: '5px' }}>REPORT PREVENTIVI ED EVENTI</h1>
          <p style={{ textAlign: 'center', fontSize: '12px', marginBottom: '20px' }}>Generato il: {new Date().toLocaleDateString('it-IT')} | Documenti totali: {allQuotes.length}</p>
          
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #000' }}>
                <th style={{ padding: '8px', textAlign: 'left' }}>ID</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>TIPO</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>CLIENTE</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>DATA EVENTO</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>LOCATION</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>TOTALE</th>
              </tr>
            </thead>
            <tbody>
              {allQuotes.map((q, i) => {
                const total = q.services.reduce((acc, s) => acc + (s.qty * s.unitPrice), 0) - q.discount;
                return (
                  <tr key={q.id} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: i % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                    <td style={{ padding: '8px', fontWeight: 'bold' }}>{q.id}</td>
                    <td style={{ padding: '8px', textTransform: 'uppercase' }}>{q.documentType}</td>
                    <td style={{ padding: '8px' }}>{q.client.name}<br/><span style={{fontSize:'8px', color:'#666'}}>{q.client.phone}</span></td>
                    <td style={{ padding: '8px' }}>{q.client.date ? new Date(q.client.date).toLocaleDateString('it-IT') : '-'}</td>
                    <td style={{ padding: '8px' }}>{q.client.location || '-'}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>€ {total.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}