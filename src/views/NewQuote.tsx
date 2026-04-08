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

interface Html2PdfStatic {
  (): Html2PdfInstance;
}

import ClientForm from '../components/ClientForm';
import ServicesList from '../components/ServicesList';
import Summary from '../components/Summary';
import PdfTemplate from '../components/PdfTemplate';
import Toast from '../components/Toast';

import { getEmptyQuote, getNextQuoteId, consumeQuoteId, getSettings } from '../utils/storage';
import type { Quote } from '../utils/types';

interface NewQuoteProps {
  initialQuote: Quote | null;
  onSave: (quote: Quote) => void;
  onBack: () => void;
}

const STATUS_LABELS: Record<Quote['status'], string> = {
  draft: '✏️ Bozza',
  sent: '📤 Inviato',
  confirmed: '✅ Confermato',
};

const STATUS_STYLES: Record<Quote['status'], string> = {
  draft: 'bg-gray-100 text-gray-600 border-gray-200',
  sent: 'bg-blue-50 text-blue-700 border-blue-200',
  confirmed: 'bg-green-50 text-green-700 border-green-200',
};

export default function NewQuote({ initialQuote, onSave, onBack }: NewQuoteProps) {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState({ text: '', visible: false, type: 'success' as 'success' | 'info' });
  const settings = getSettings();

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showErrors, setShowErrors] = useState(false);
  const [autoSavedAt, setAutoSavedAt] = useState<Date | null>(null);

  const [quote, setQuote] = useState<Quote>(() => {
    if (initialQuote) {
      // Migrazione: preventivi vecchi potrebbero non avere selectedNotes/promoLocale
      return {
        ...initialQuote,
        selectedNotes: initialQuote.selectedNotes ?? [],
        promoLocale: initialQuote.promoLocale ?? false,
      };
    }
    return {
      id: getNextQuoteId(),
      createdAt: new Date().toISOString(),
      ...getEmptyQuote(),
    } as Quote;
  });

  const isValid = quote.client.name.trim() !== '' && quote.client.date !== '';

  // Listener online/offline
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Autosave silenzioso ogni 2s se i dati minimi sono validi
  useEffect(() => {
    if (!isValid) return;
    const timer = setTimeout(() => {
      onSave(quote);
      setAutoSavedAt(new Date());
    }, 2000);
    return () => clearTimeout(timer);
  }, [quote, isValid, onSave]);

  // Chiudi i menu se si clicca altrove
  useEffect(() => {
    const close = () => {
      setShowExportMenu(false);
      setShowStatusMenu(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const showToast = (text: string, type: 'success' | 'info' = 'success') => {
    setToastMessage({ text, visible: true, type });
    setTimeout(() => setToastMessage(prev => ({ ...prev, visible: false })), 3000);
  };

  const handleManualSave = () => {
    if (!isValid) {
      setShowErrors(true);
      showToast('Compila Nome e Data Evento', 'info');
      return;
    }
    if (quote.id === getNextQuoteId()) consumeQuoteId();

    setIsSaving(true);
    setTimeout(() => {
      onSave(quote);
      setIsSaving(false);
      showToast('Preventivo salvato!');
    }, 500);
  };

  // Cambio stato — salva immediatamente
  const handleStatusChange = (newStatus: Quote['status']) => {
    const updated = { ...quote, status: newStatus };
    setQuote(updated);
    if (isValid) {
      if (updated.id === getNextQuoteId()) consumeQuoteId();
      onSave(updated);
    }
    setShowStatusMenu(false);
    showToast(`Stato aggiornato: ${STATUS_LABELS[newStatus]}`);
  };

  const handleReset = () => {
    if (confirm('Sei sicuro di voler svuotare tutto? I dati non salvati andranno persi.')) {
      setQuote({
        id: getNextQuoteId(),
        createdAt: new Date().toISOString(),
        ...getEmptyQuote(),
      } as Quote);
      setShowErrors(false);
      showToast('Form svuotato', 'info');
    }
  };

  const handleExport = (format: 'pdf' | 'jpeg' | 'png') => {
    if (!isValid) {
      setShowErrors(true);
      showToast('Compila Nome e Data Evento prima di esportare', 'info');
      setShowExportMenu(false);
      return;
    }
    if (quote.id === getNextQuoteId()) consumeQuoteId();

    setIsGeneratingPdf(true);
    setShowExportMenu(false);
    onSave(quote);

    setTimeout(() => {
      const element = document.getElementById('pdf-template-container');
      if (!element) {
        setIsGeneratingPdf(false);
        showToast('Errore Export. Riprova.', 'info');
        return;
      }

      const clientName = quote.client.name ? quote.client.name.replace(/\s+/g, '_') : 'Cliente';
      const filename = `${quote.id}_${clientName}`;

      const opt = {
        margin: 0,
        filename: `${filename}.${format}`,
        image: { type: format === 'png' ? 'png' : 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
      };

      const pdfWorker = (html2pdf as unknown as Html2PdfStatic)().set(opt).from(element);

      if (format === 'pdf') {
        pdfWorker
          .save()
          .then(() => { setIsGeneratingPdf(false); showToast('PDF Generato!'); })
          .catch((err: Error) => { console.error(err); setIsGeneratingPdf(false); showToast('Errore PDF.', 'info'); });
      } else {
        pdfWorker
          .outputImg('datauristring')
          .then((base64String: string) => {
            const link = document.createElement('a');
            link.href = base64String;
            link.download = `${filename}.${format}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setIsGeneratingPdf(false);
            showToast(`Immagine ${format.toUpperCase()} scaricata!`);
          })
          .catch((err: Error) => { console.error(err); setIsGeneratingPdf(false); showToast(`Errore ${format.toUpperCase()}.`, 'info'); });
      }
    }, 300);
  };

  return (
    <div className="space-y-6 relative">
      {/* Header sticky */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 bg-[var(--bg-primary)]/80 backdrop-blur-md z-10 py-2 -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
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
              {autoSavedAt && (
                <span className="text-[10px] text-gray-400 font-medium">
                  ● Autosave {autoSavedAt.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <button
            onClick={handleReset}
            className="px-4 py-2.5 text-[var(--text-secondary)] hover:text-red-500 hover:bg-red-50 rounded-xl font-medium transition text-sm"
          >
            Svuota
          </button>

          {/* Selector stato documento */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
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
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="absolute right-0 mt-1 w-40 bg-white border border-[var(--border)] rounded-xl shadow-lg z-50 overflow-hidden"
                >
                  {(['draft', 'sent', 'confirmed'] as Quote['status'][]).map(s => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      disabled={quote.status === s}
                      className={`w-full text-left px-4 py-2.5 text-sm font-medium transition hover:bg-[var(--bg-tertiary)] flex items-center gap-2 ${
                        quote.status === s ? 'opacity-40 cursor-default' : ''
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${
                        s === 'confirmed' ? 'bg-green-500' :
                        s === 'sent' ? 'bg-blue-500' : 'bg-gray-400'
                      }`} />
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Export menu */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowExportMenu(v => !v)}
              disabled={isGeneratingPdf}
              className={`px-5 py-2.5 border border-[var(--border)] text-[var(--text-primary)] rounded-xl font-medium shadow-[var(--shadow-card)] transition flex items-center gap-2 ${
                isGeneratingPdf ? 'bg-gray-100 opacity-70 cursor-not-allowed' : 'bg-white hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              {isGeneratingPdf ? '⏳ Export...' : '📄 Esporta...'}
            </motion.button>

            <AnimatePresence>
              {showExportMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute right-0 mt-2 w-48 bg-white border border-[var(--border)] rounded-xl shadow-lg z-50 overflow-hidden"
                >
                  <div className="py-1">
                    <button onClick={() => handleExport('pdf')} className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--bg-tertiary)] transition flex items-center gap-2">
                      <span className="text-red-500 font-bold">PDF</span> Documento
                    </button>
                    <button onClick={() => handleExport('jpeg')} className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--bg-tertiary)] transition flex items-center gap-2 border-t border-[var(--border)]/50">
                      <span className="text-blue-500 font-bold">JPEG</span> Leggero
                    </button>
                    <button onClick={() => handleExport('png')} className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--bg-tertiary)] transition flex items-center gap-2 border-t border-[var(--border)]/50">
                      <span className="text-purple-500 font-bold">PNG</span> Alta qualità
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
            {isSaving ? '⏳ Salvo...' : '💾 Salva'}
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

      {/* Template PDF nascosto */}
      <div style={{ position: 'absolute', top: '-10000px', left: '-10000px', width: '210mm' }}>
        <PdfTemplate quote={quote} settings={settings} />
      </div>
    </div>
  );
}