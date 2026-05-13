/**
 * NewQuote.tsx
 *
 * Regole:
 * - Il salvataggio avviene SOLO su azione esplicita dell'utente (clic "Salva",
 *   cambio status, o Export). Nessun autosave.
 * - L'ID atomico Supabase viene richiesto al primo salvataggio, non prima.
 * - Il PdfTemplate è SEMPRE nel DOM (position:fixed fuori viewport) → il font
 *   base64 è già caricato quando l'utente clicca Esporta → export veloce.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  outputImg: (type: string) => Promise<string>;
}
interface Html2PdfStatic { (): Html2PdfInstance; }

import ClientForm   from '../components/ClientForm';
import ServicesList from '../components/ServicesList';
import Summary      from '../components/Summary';
import PdfTemplate  from '../components/PdfTemplate';
import Toast        from '../components/Toast';

import {
  getEmptyQuote,
  getNextQuoteId,
  consumeQuoteId,
  getSettings,
  localSaveQuote,
} from '../utils/storage';
import { dbNextQuoteId } from '../utils/db';
import type { Quote } from '../utils/types';

interface NewQuoteProps {
  initialQuote: Quote | null;
  onSave:       (quote: Quote) => void;
  onBack:       () => void;
}

const STATUS_LABELS: Record<Quote['status'], string> = {
  draft:     '✏️ Bozza',
  sent:      '📤 Inviato',
  confirmed: '✅ Confermato',
};

const STATUS_STYLES: Record<Quote['status'], string> = {
  draft:     'bg-gray-100 text-gray-600 border-gray-200',
  sent:      'bg-blue-50 text-blue-700 border-blue-200',
  confirmed: 'bg-green-50 text-green-700 border-green-200',
};

export default function NewQuote({ initialQuote, onSave, onBack }: NewQuoteProps) {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSaving,        setIsSaving]        = useState(false);
  const [toastMessage,    setToastMessage]    = useState({
    text: '', visible: false, type: 'success' as 'success' | 'info',
  });
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [isOnline,       setIsOnline]       = useState(navigator.onLine);
  const [showErrors,     setShowErrors]     = useState(false);

  // true = questo preventivo ha già un ID atomico Supabase
  const [idConsumed, setIdConsumed] = useState(!!initialQuote);

  const settings = getSettings();

  const [quote, setQuote] = useState<Quote>(() => {
    if (initialQuote) {
      return {
        ...initialQuote,
        selectedNotes: initialQuote.selectedNotes ?? [],
        promoLocale:   initialQuote.promoLocale   ?? false,
        acconto:       initialQuote.acconto       ?? 0,
      };
    }
    // ID temporaneo locale, verrà sostituito al primo salvataggio
    return {
      id:        getNextQuoteId(),
      createdAt: new Date().toISOString(),
      ...getEmptyQuote(),
    } as Quote;
  });

  const isValid = quote.client.name.trim() !== '' && quote.client.date !== '';

  // ── Autosave in localStorage (silenzioso, nessuna chiamata DB) ───────
  // Si attiva 800ms dopo ogni modifica al form.
  // Il salvataggio su Supabase avviene SOLO su clic "Salva".
  useEffect(() => {
    const timer = setTimeout(() => {
      localSaveQuote(quote);
    }, 800);
    return () => clearTimeout(timer);
  }, [quote]);

  // ── Online/offline ───────────────────────────────────────────────────
  useEffect(() => {
    const up   = () => setIsOnline(true);
    const down = () => setIsOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  // ── Chiudi menu al click fuori ───────────────────────────────────────
  useEffect(() => {
    const close = () => { setShowExportMenu(false); setShowStatusMenu(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  // ── Utilities ────────────────────────────────────────────────────────
  const showToast = (text: string, type: 'success' | 'info' = 'success') => {
    setToastMessage({ text, visible: true, type });
    setTimeout(() => setToastMessage(p => ({ ...p, visible: false })), 3000);
  };

  /** Garantisce che il preventivo abbia un ID atomico Supabase con il prefisso corretto. */
  const ensureAtomicId = async (current: Quote): Promise<Quote> => {
    if (idConsumed) return current;
    let atomicId: string;
    const prefix = current.documentType === 'contratto' ? 'CONTR' : 'PREV';
    try {
      const rawId = await dbNextQuoteId(); // es. "PREV-007"
      // Sostituisce il prefisso con quello corretto per il tipo documento
      atomicId = rawId.replace(/^[A-Z]+-/, `${prefix}-`);
    } catch {
      const counter = getNextQuoteId().replace(/^[A-Z]+-/, '');
      atomicId = `${prefix}-${counter}`;
    }
    consumeQuoteId();
    const updated = { ...current, id: atomicId };
    setQuote(updated);
    setIdConsumed(true);
    return updated;
  };

  // ── Salva su DB (unica via al database) ─────────────────────────────
  const handleManualSave = async () => {
    if (!isValid) {
      setShowErrors(true);
      showToast('Compila Nome e Data Evento', 'info');
      return;
    }
    setIsSaving(true);
    try {
      const q = await ensureAtomicId(quote);
      onSave(q);
      const label = q.documentType === 'contratto' ? 'Contratto salvato!' : 'Preventivo salvato!';
      showToast(label);
    } catch (err) {
      console.error('[NewQuote] save error:', err);
      showToast('Errore durante il salvataggio', 'info');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Torna indietro — salva bozza locale se dati minimi presenti ──────
  const handleBack = () => {
    if (isValid) {
      localSaveQuote(quote); // salva bozza in localStorage prima di uscire
    }
    onBack();
  };

  // ── Cambio status (salva subito) ─────────────────────────────────────
  const handleStatusChange = async (newStatus: Quote['status']) => {
    const updated = { ...quote, status: newStatus };
    setQuote(updated);
    if (isValid) {
      try {
        const q = await ensureAtomicId(updated);
        onSave(q);
      } catch (err) {
        console.error('[NewQuote] status-save error:', err);
      }
    }
    setShowStatusMenu(false);
    showToast(`Stato: ${STATUS_LABELS[newStatus]}`);
  };

  // ── Reset ────────────────────────────────────────────────────────────
  const handleReset = () => {
    if (!confirm('Sei sicuro di voler svuotare tutto? I dati non salvati andranno persi.')) return;
    setQuote({
      id: getNextQuoteId(), createdAt: new Date().toISOString(), ...getEmptyQuote(),
    } as Quote);
    setIdConsumed(false);
    setShowErrors(false);
    showToast('Form svuotato', 'info');
  };

  // ── Export PDF / JPEG / PNG ──────────────────────────────────────────
  const handleExport = async (format: 'pdf' | 'jpeg' | 'png') => {
    if (!isValid) {
      setShowErrors(true);
      showToast('Compila Nome e Data Evento prima di esportare', 'info');
      setShowExportMenu(false);
      return;
    }
    setIsGeneratingPdf(true);
    setShowExportMenu(false);

    // Salva con ID stabile prima di catturare
    let q = quote;
    try {
      q = await ensureAtomicId(quote);
      onSave(q);
    } catch (err) {
      console.error('[NewQuote] export pre-save error:', err);
    }

    // Aspetta 2 frame + 500ms: assicura che il font base64 sia applicato
    await new Promise<void>(resolve =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          setTimeout(resolve, 500)
        )
      )
    );

    const element = document.getElementById('pdf-template-container');
    if (!element) {
      setIsGeneratingPdf(false);
      showToast('Errore: template non trovato, riprova.', 'info');
      return;
    }

    const clientName = q.client.name ? q.client.name.replace(/\s+/g, '_') : 'Cliente';
    const filename   = `${q.id}_${clientName}`;

    const opt: Html2PdfOptions = {
      margin:      0,
      filename:    `${filename}.${format}`,
      image:       { type: format === 'png' ? 'png' : 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' },
    };

    const worker = (html2pdf as unknown as Html2PdfStatic)().set(opt).from(element);

    try {
      if (format === 'pdf') {
        await worker.save();
        showToast('PDF generato!');
      } else {
        const dataUri = await worker.outputImg('datauristring');
        const link = document.createElement('a');
        link.href = dataUri;
        link.download = `${filename}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast(`${format.toUpperCase()} scaricato!`);
      }
    } catch (err) {
      console.error('[NewQuote] export error:', err);
      showToast(`Errore export ${format.toUpperCase()}`, 'info');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 relative">

      {/* Header sticky */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 bg-[var(--bg-primary)]/80 backdrop-blur-md z-10 py-2 -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-[var(--shadow-card)] hover:bg-[var(--bg-tertiary)] transition text-lg"
          >
            ←
          </button>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">
              {initialQuote ? 'Modifica Documento' : 'Nuovo Documento'}
            </h1>
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-[var(--accent)]">{quote.id}</p>
              <span
                className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`}
                title={isOnline ? 'Online' : 'Offline — dati salvati in locale'}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          {/* Svuota */}
          <button
            onClick={handleReset}
            className="px-4 py-2.5 text-[var(--text-secondary)] hover:text-red-500 hover:bg-red-50 rounded-xl font-medium transition text-sm"
          >
            Svuota
          </button>

          {/* Status */}
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowStatusMenu(v => !v)}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition flex items-center gap-1.5 ${STATUS_STYLES[quote.status]}`}
            >
              {STATUS_LABELS[quote.status]}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            <AnimatePresence>
              {showStatusMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                  className="absolute right-0 mt-1 w-40 bg-white border border-[var(--border)] rounded-xl shadow-lg z-50 overflow-hidden"
                >
                  {(['draft', 'sent', 'confirmed'] as Quote['status'][]).map(s => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      disabled={quote.status === s}
                      className={`w-full text-left px-4 py-2.5 text-sm font-medium transition hover:bg-[var(--bg-tertiary)] flex items-center gap-2 ${quote.status === s ? 'opacity-40 cursor-default' : ''}`}
                    >
                      <span className={`w-2 h-2 rounded-full ${s === 'confirmed' ? 'bg-green-500' : s === 'sent' ? 'bg-blue-500' : 'bg-gray-400'}`} />
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Esporta */}
          <div className="relative" onClick={e => e.stopPropagation()}>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowExportMenu(v => !v)}
              disabled={isGeneratingPdf}
              className={`px-5 py-2.5 border border-[var(--border)] text-[var(--text-primary)] rounded-xl font-medium shadow-[var(--shadow-card)] transition flex items-center gap-2 ${
                isGeneratingPdf ? 'bg-gray-100 opacity-70 cursor-not-allowed' : 'bg-white hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              {isGeneratingPdf
                ? <><span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> Export...</>
                : '📄 Esporta...'}
            </motion.button>
            <AnimatePresence>
              {showExportMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                  className="absolute right-0 mt-2 w-48 bg-white border border-[var(--border)] rounded-xl shadow-lg z-50 overflow-hidden"
                >
                  <div className="py-1">
                    <button onClick={() => handleExport('pdf')}  className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--bg-tertiary)] transition flex items-center gap-2">
                      <span className="text-red-500 font-bold text-xs">PDF</span> Documento
                    </button>
                    <button onClick={() => handleExport('jpeg')} className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--bg-tertiary)] transition flex items-center gap-2 border-t border-[var(--border)]/50">
                      <span className="text-blue-500 font-bold text-xs">JPEG</span> Leggero
                    </button>
                    <button onClick={() => handleExport('png')}  className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--bg-tertiary)] transition flex items-center gap-2 border-t border-[var(--border)]/50">
                      <span className="text-purple-500 font-bold text-xs">PNG</span> Alta qualità
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Salva */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleManualSave}
            disabled={isSaving}
            className={`px-6 py-2.5 text-white rounded-xl font-medium shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-hover)] transition flex items-center gap-2 ${
              isSaving ? 'bg-gray-400' : 'bg-[var(--accent)]'
            }`}
          >
            {isSaving
              ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Salvo...</>
              : '💾 Salva'}
          </motion.button>
        </div>
      </header>

      {/* Layout principale */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pb-10">
        <div className="lg:col-span-8 space-y-6">
          <ClientForm
            data={quote.client}
            onChange={(client) => setQuote({ ...quote, client })}
            showErrors={showErrors}
          />
          <ServicesList
            services={quote.services}
            onChange={(services) => setQuote({ ...quote, services })}
          />
        </div>
        <div className="lg:col-span-4 space-y-6">
          <Summary
            services={quote.services}
            discount={quote.discount}
            onDiscountChange={(discount) => setQuote({ ...quote, discount })}
            selectedNotes={quote.selectedNotes ?? []}
            onSelectedNotesChange={(selectedNotes) => setQuote({ ...quote, selectedNotes })}
            notes={quote.notes}
            acconto={quote.acconto ?? 0} // <-- AGGIUNTO
            onAccontoChange={(acconto) => setQuote({ ...quote, acconto })} // <-- AGGIUNTO  
            onNotesChange={(notes) => setQuote({ ...quote, notes })}
            documentType={quote.documentType}
            onDocumentTypeChange={(type) => setQuote({ ...quote, documentType: type })}
            paymentMethod={quote.paymentMethod}
            onPaymentMethodChange={(method) => setQuote({ ...quote, paymentMethod: method })}
            promoLocale={quote.promoLocale ?? false}
            onPromoLocaleChange={(promoLocale) => setQuote({ ...quote, promoLocale })}
          />
        </div>
      </div>

      <Toast message={toastMessage.text} isVisible={toastMessage.visible} type={toastMessage.type} />

      {/*
        PdfTemplate SEMPRE nel DOM, fuori viewport (position:fixed).
        Il browser pre-carica il font base64 → export istantaneo.
        L'id="pdf-template-container" è dentro PdfTemplate stesso.
      */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: '-99999px',
          left: '-99999px',
          width: '210mm',
          pointerEvents: 'none',
          zIndex: -1,
        }}
      >
        <PdfTemplate quote={quote} settings={settings} />
      </div>
    </div>
  );
}