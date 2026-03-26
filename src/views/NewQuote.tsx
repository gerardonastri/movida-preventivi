import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
// FIX PUNTO 3: Import standard e casting sicuro a "any" nell'uso sotto
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

import ClientForm from '../components/ClientForm';
import ServicesList from '../components/ServicesList';
import Summary from '../components/Summary';
import PdfTemplate from '../components/PdfTemplate';
import Toast from '../components/Toast';

// FIX PUNTO 2: Usiamo generateQuoteId per evitare bug di ID su Strict Mode
import { getEmptyQuote, generateQuoteId, getSettings } from '../utils/storage';
import type { Quote } from '../utils/types';

interface NewQuoteProps {
  initialQuote: Quote | null;
  onSave: (quote: Quote) => void;
  onBack: () => void;
}

export default function NewQuote({ initialQuote, onSave, onBack }: NewQuoteProps) {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState({ text: '', visible: false, type: 'success' as 'success' | 'info' });
  const settings = getSettings();

  // FIX PUNTO 13 & 15: Stati per validazione e autosave
  const [showErrors, setShowErrors] = useState(false);
  const [autoSavedAt, setAutoSavedAt] = useState<Date | null>(null);

  const [quote, setQuote] = useState<Quote>(() => {
    if (initialQuote) return { ...initialQuote };
    // generateQuoteId crea un nuovo ID e aggiorna il contatore
    return { id: generateQuoteId(), createdAt: new Date().toISOString(), ...getEmptyQuote() } as Quote;
  });

  // Validazione di base
  const isValid = quote.client.name.trim() !== '' && quote.client.date !== '';

  // FIX PUNTO 13: Autosave silenzioso se i dati minimi sono validi
  useEffect(() => {
    if (!isValid) return;
    const timer = setTimeout(() => {
      onSave(quote);
      setAutoSavedAt(new Date());
    }, 2000);
    return () => clearTimeout(timer);
  }, [quote]);

  const showToast = (text: string, type: 'success' | 'info' = 'success') => {
    setToastMessage({ text, visible: true, type });
    setTimeout(() => setToastMessage(prev => ({ ...prev, visible: false })), 3000);
  };

  const handleManualSave = () => {
    if (!isValid) {
      setShowErrors(true);
      showToast("Compila Nome e Data Evento", "info");
      return;
    }

    setIsSaving(true);
    // Fake loading per UX premium
    setTimeout(() => {
      onSave(quote);
      setIsSaving(false);
      showToast("Preventivo salvato!");
    }, 500);
  };

  const handleReset = () => {
    if (confirm("Sei sicuro di voler svuotare tutto? I dati non salvati andranno persi.")) {
      setQuote({ id: generateQuoteId(), createdAt: new Date().toISOString(), ...getEmptyQuote() } as Quote);
      setShowErrors(false);
      showToast("Form svuotato", "info");
    }
  };

  const handleGeneratePdf = () => {
    if (!isValid) {
      setShowErrors(true);
      showToast("Compila Nome e Data Evento prima di generare il PDF", "info");
      return;
    }

    setIsGeneratingPdf(true);
    onSave(quote); // Salva i dati correnti prima di stampare

    // Usiamo setTimeout per assicurarci che React abbia finito di iniettare i dati nel dom nascosto
    setTimeout(() => {
      const element = document.getElementById('pdf-template-container');
      
      if (!element) {
        setIsGeneratingPdf(false);
        showToast("Errore PDF. Riprova.", "info");
        return;
      }

      const clientName = quote.client.name ? quote.client.name.replace(/\s+/g, '_') : 'Cliente';
      const filename = `${quote.id}_${clientName}.pdf`;

      const opt = {
        margin: 0,
        filename: filename,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          backgroundColor: '#ffffff'
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
      };

      // Esecuzione tramite TS bypass
      (html2pdf as unknown as Html2PdfStatic)().set(opt).from(element).save().then(() => {
        setIsGeneratingPdf(false);
        showToast("PDF Generato con successo!");
      }).catch((err: Error) => {
        console.error(err);
        setIsGeneratingPdf(false);
        showToast("Errore nella generazione PDF.", "info");
      });
    }, 300);
  };

  return (
    <div className="space-y-6 relative">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 bg-[var(--bg-primary)]/80 backdrop-blur-md z-10 py-2 -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-[var(--shadow-card)] hover:bg-[var(--bg-tertiary)] transition text-lg">←</button>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">
              {initialQuote ? 'Modifica Preventivo' : 'Nuovo Preventivo'}
            </h1>
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-[var(--accent)]">{quote.id}</p>
              {autoSavedAt && (
                <span className="text-[10px] text-gray-400 font-medium">
                  ● Autosave {autoSavedAt.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <button onClick={handleReset} className="px-4 py-2.5 text-[var(--text-secondary)] hover:text-red-500 hover:bg-red-50 rounded-xl font-medium transition text-sm">
            Svuota Form
          </button>
          <motion.button 
            whileTap={{ scale: 0.97 }} onClick={handleGeneratePdf} disabled={isGeneratingPdf}
            className={`px-5 py-2.5 border border-[var(--border)] text-[var(--text-primary)] rounded-xl font-medium shadow-[var(--shadow-card)] transition flex items-center gap-2
              ${isGeneratingPdf ? 'bg-gray-100 opacity-70 cursor-not-allowed' : 'bg-white hover:bg-[var(--bg-tertiary)]'}`}
          >
            {isGeneratingPdf ? '⏳ PDF...' : '📄 Scarica PDF'}
          </motion.button>
          <motion.button 
            whileTap={{ scale: 0.97 }} onClick={handleManualSave} disabled={isSaving}
            className={`px-6 py-2.5 text-white rounded-xl font-medium shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-hover)] transition flex items-center gap-2
              ${isSaving ? 'bg-gray-400' : 'bg-[var(--accent)]'}`}
          >
            {isSaving ? '⏳ Salvo...' : '💾 Salva'}
          </motion.button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pb-10">
        <div className="lg:col-span-8 space-y-6">
          <ClientForm data={quote.client} onChange={(client) => setQuote({ ...quote, client })} showErrors={showErrors} />
          <ServicesList services={quote.services} onChange={(services) => setQuote({ ...quote, services })} />
        </div>
        <div className="lg:col-span-4 space-y-6">
          <Summary 
            services={quote.services} 
            discount={quote.discount} 
            onDiscountChange={(discount) => setQuote({ ...quote, discount })} 
            notes={quote.notes} 
            onNotesChange={(notes) => setQuote({ ...quote, notes })} 
            documentType={quote.documentType}
            onDocumentTypeChange={(type) => setQuote({ ...quote, documentType: type })}
            paymentMethod={quote.paymentMethod}
            onPaymentMethodChange={(method) => setQuote({ ...quote, paymentMethod: method })}
          />
        </div>
      </div>

      <Toast message={toastMessage.text} isVisible={toastMessage.visible} type={toastMessage.type} />

      {/* TEMPLATE PDF NASCOSTO 
          Spostato fuori dallo schermo con posizionamento assoluto negativo 
          per non causare problemi a html2canvas
      */}
      <div 
        style={{
          position: 'absolute',
          top: '-10000px',
          left: '-10000px',
          width: '210mm'
        }}
      >
        <PdfTemplate quote={quote} settings={settings} />
      </div>
    </div>
  );
}