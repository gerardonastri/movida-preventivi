import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import Toast from '../components/Toast';
import { getSettings, saveSettings, getQuotes } from '../utils/storage';
import { dbSaveSettings } from '../utils/db';
import type { CompanySettings } from '../utils/types';
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';

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

interface SettingsProps {
  /** Quotes passati dall'hook useAppData — usati per export aggiornati */
  quotes?: ReturnType<typeof getQuotes>;
}

export default function Settings({ quotes: propQuotes }: SettingsProps) {
  const [settings, setSettings] = useState<CompanySettings>(getSettings());
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [toastConfig, setToastConfig] = useState({ visible: false, message: '', type: 'success' as 'success' | 'info' });

  // const logoInputRef  = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  // Usa i quotes dal prop se disponibili, altrimenti legge da localStorage
  const allQuotes = propQuotes ?? getQuotes();

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToastConfig({ visible: true, message, type });
    setTimeout(() => setToastConfig(prev => ({ ...prev, visible: false })), 3500);
  };

  const handleChange = (field: keyof CompanySettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  // ── Logo upload ────────────────────────────────────────────────────────────


  // ── Save — localStorage immediato + Supabase asincrono con feedback reale ──
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 1. Salva su localStorage subito (sincrono)
      saveSettings(settings);

      // 2. Salva su Supabase e aspetta la conferma
      const ok = await dbSaveSettings(settings);

      if (ok) {
        showToast('Impostazioni salvate con successo!');
      } else {
        // Supabase ha fallito ma localStorage è aggiornato — l'utente è avvisato
        showToast('Salvato in locale. Supabase non raggiungibile.', 'info');
      }
    } catch (err) {
      console.error('[Settings] save error:', err);
      showToast('Errore durante il salvataggio.', 'info');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Backup JSON ────────────────────────────────────────────────────────────
  const handleExportJson = () => {
    try {
      const backupData = {
        quotes:   localStorage.getItem('preventivi_quotes'),
        counter:  localStorage.getItem('preventivi_counter'),
        settings: localStorage.getItem('preventivi_settings'),
      };
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `Movida_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Backup JSON scaricato!');
    } catch (err) {
      console.error(err);
      showToast('Errore generazione backup.', 'info');
    }
  };

  // ── Export Excel — usa allQuotes (aggiornati da Supabase) ─────────────────
  const handleExportExcel = () => {
    try {
      if (allQuotes.length === 0) { showToast('Nessun preventivo da esportare.', 'info'); return; }

      const data = allQuotes.map(q => {
        const subtotal     = q.services.reduce((acc, s) => acc + s.qty * s.unitPrice, 0);
        const itemDiscounts = q.services.reduce((acc, s) => acc + (s.itemDiscount || 0), 0);
        const total        = subtotal - (q.discount || 0) - itemDiscounts;
        return {
          'ID Documento':      q.id,
          'Tipo':              q.documentType.toUpperCase(),
          'Stato':             q.status.toUpperCase(),
          'Data Creazione':    new Date(q.createdAt).toLocaleDateString('it-IT'),
          'Nome Cliente':      q.client.name,
          'Telefono':          q.client.phone,
          'Evento':            q.client.eventType,
          'Data Evento':       q.client.date,
          'Location':          q.client.location,
          'Pagamento':         q.paymentMethod.toUpperCase(),
          'Subtotale (€)':     subtotal,
          'Sconti Righe (€)':  itemDiscounts,
          'Sconto Globale (€)': q.discount || 0,
          'Totale (€)':        total,
        };
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Archivio');
      XLSX.writeFile(wb, `Movida_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
      showToast('Report Excel scaricato!');
    } catch (err) {
      console.error(err);
      showToast('Errore generazione Excel.', 'info');
    }
  };

  // ── Export PDF Report ──────────────────────────────────────────────────────
  const handleExportPdf = () => {
    if (allQuotes.length === 0) { showToast('Nessun preventivo da esportare.', 'info'); return; }
    setIsGeneratingPdf(true);
    setTimeout(() => {
      const element = document.getElementById('pdf-backup-container');
      if (!element) { setIsGeneratingPdf(false); return; }
      const opt = {
        margin: 10,
        filename: `Movida_Report_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' as const },
      };
      (html2pdf as unknown as Html2PdfStatic)().set(opt).from(element).save()
        .then(() => { setIsGeneratingPdf(false); showToast('Report PDF scaricato!'); })
        .catch(() => { setIsGeneratingPdf(false); showToast('Errore PDF.', 'info'); });
    }, 300);
  };

  // ── Import backup JSON ─────────────────────────────────────────────────────
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.quotes)   localStorage.setItem('preventivi_quotes',   data.quotes);
        if (data.counter)  localStorage.setItem('preventivi_counter',  data.counter);
        if (data.settings) {
          localStorage.setItem('preventivi_settings', data.settings);
          setSettings(JSON.parse(data.settings));
        }
        showToast('Backup ripristinato! Riavvio...');
        setTimeout(() => window.location.reload(), 1500);
      } catch {
        showToast('File non valido.', 'info');
      }
    };
    reader.readAsText(file);
    if (backupInputRef.current) backupInputRef.current.value = '';
  };

  const inputClass = "w-full bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none transition border border-transparent focus:border-[var(--accent)]";
  const labelClass = "block text-sm font-medium text-[var(--text-secondary)] mb-1.5 ml-1";

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12 relative">
      <header>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Impostazioni Azienda</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Questi dati verranno stampati sui preventivi in PDF.</p>
      </header>

      {/* ── Form impostazioni ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-6 shadow-[var(--shadow-card)] border border-[var(--border)] space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          <div>
            <label className={labelClass}>Nome Azienda</label>
            <input value={settings.name} onChange={(e) => handleChange('name', e.target.value)} className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Email</label>
            <input type="email" value={settings.email} onChange={(e) => handleChange('email', e.target.value)} className={inputClass} />
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

          <div className="md:col-span-2">
            <label className={labelClass}>
              Testo "Richiesta Fattura Elettronica" <span className="text-[var(--text-muted)] font-normal">(stampato nel PDF)</span>
            </label>
            <textarea
              value={settings.invoiceText || ''}
              onChange={(e) => handleChange('invoiceText', e.target.value)}
              rows={2}
              placeholder="Da compilare per richiesta fattura elettronica: P.IVA/C.F. ___ Codice SDI / PEC ___"
              className={`${inputClass} resize-none`}
            />
            <p className="text-xs text-[var(--text-muted)] mt-1 ml-1">
              Appare in grassetto nella sezione pagamento del PDF.
            </p>
          </div>

          {/* ── Logo aziendale ────────────────────────────────────────────── */}
          
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
          <p className="text-xs text-[var(--text-muted)]">
            Le modifiche vengono sincronizzate su tutti i dispositivi.
          </p>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleSave}
            disabled={isSaving}
            className={`px-8 py-3 rounded-xl font-medium text-white shadow-[var(--shadow-card)] transition min-w-[160px] ${
              isSaving ? 'bg-gray-400 cursor-wait' : 'bg-[var(--accent)] hover:shadow-[var(--shadow-hover)]'
            }`}
          >
            {isSaving ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Salvataggio…
              </span>
            ) : 'Salva Impostazioni'}
          </motion.button>
        </div>
      </div>

      {/* ── Esportazione e Backup ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-6 shadow-[var(--shadow-card)] border border-[var(--border)] space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <span className="bg-blue-100 text-blue-600 w-10 h-10 rounded-xl flex items-center justify-center text-xl">💾</span>
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Esportazione e Backup Dati</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              Scarica i tuoi preventivi in vari formati o esegui un backup completo.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-[var(--border)]">
          <div className="flex flex-col gap-2">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleExportJson}
              className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-medium transition flex items-center justify-center gap-2 border border-gray-300"
            >
              ⚙️ Backup JSON
            </motion.button>
            <p className="text-[10px] text-center text-[var(--text-muted)]">Copia di sistema per il ripristino.</p>
          </div>

          <div className="flex flex-col gap-2">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleExportExcel}
              className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-medium transition flex items-center justify-center gap-2 border border-emerald-200"
            >
              📊 Export Excel
            </motion.button>
            <p className="text-[10px] text-center text-[var(--text-muted)]">Per contabilità e analisi dati.</p>
          </div>

          <div className="flex flex-col gap-2">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleExportPdf}
              disabled={isGeneratingPdf}
              className={`w-full py-2.5 rounded-xl font-medium transition flex items-center justify-center gap-2 border ${
                isGeneratingPdf
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-wait'
                  : 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
              }`}
            >
              {isGeneratingPdf ? '⏳ Generazione…' : '📄 Stampa Report PDF'}
            </motion.button>
            <p className="text-[10px] text-center text-[var(--text-muted)]">Tabella riassuntiva da stampare.</p>
          </div>
        </div>

        <div className="pt-4 mt-2 border-t border-[var(--border)] flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[var(--text-secondary)]">
            Hai cambiato dispositivo? Ripristina un backup JSON precedente.
          </p>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => backupInputRef.current?.click()}
            className="whitespace-nowrap px-6 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border)] text-[var(--text-primary)] rounded-xl font-medium transition flex items-center gap-2 text-sm"
          >
            ⬆️ Ripristina da JSON
          </motion.button>
          <input type="file" accept=".json" ref={backupInputRef} onChange={handleImportBackup} className="hidden" />
        </div>
      </div>

      <Toast message={toastConfig.message} isVisible={toastConfig.visible} type={toastConfig.type} />

      {/* Template PDF nascosto per il report generale */}
      <div style={{ position: 'absolute', top: '-10000px', left: '-10000px', width: '297mm' }}>
        <div id="pdf-backup-container" style={{ padding: '20px', backgroundColor: '#fff', color: '#000', fontFamily: 'Arial, sans-serif' }}>
          <h1 style={{ textAlign: 'center', color: '#1e3a8a', marginBottom: '5px' }}>REPORT PREVENTIVI ED EVENTI</h1>
          <p style={{ textAlign: 'center', fontSize: '12px', marginBottom: '20px' }}>
            Generato il: {new Date().toLocaleDateString('it-IT')} | Documenti totali: {allQuotes.length}
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #000' }}>
                <th style={{ padding: '8px', textAlign: 'left' }}>ID</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>TIPO</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>STATO</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>CLIENTE</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>DATA EVENTO</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>LOCATION</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>TOTALE</th>
              </tr>
            </thead>
            <tbody>
              {allQuotes.map((q, i) => {
                const itemDisc = q.services.reduce((acc, s) => acc + (s.itemDiscount || 0), 0);
                const total    = q.services.reduce((acc, s) => acc + s.qty * s.unitPrice, 0) - (q.discount || 0) - itemDisc;
                return (
                  <tr key={q.id} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                    <td style={{ padding: '8px', fontWeight: 'bold' }}>{q.id}</td>
                    <td style={{ padding: '8px', textTransform: 'uppercase' }}>{q.documentType}</td>
                    <td style={{ padding: '8px', textTransform: 'uppercase' }}>{q.status}</td>
                    <td style={{ padding: '8px' }}>
                      {q.client.name}<br />
                      <span style={{ fontSize: '8px', color: '#666' }}>{q.client.phone}</span>
                    </td>
                    <td style={{ padding: '8px' }}>
                      {q.client.date ? new Date(q.client.date).toLocaleDateString('it-IT') : '—'}
                    </td>
                    <td style={{ padding: '8px' }}>{q.client.location || '—'}</td>
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