import { useState } from 'react';
import { motion } from 'framer-motion';
// ts-expect-error
import * as html2pdfModule from 'html2pdf.js';
// Forza Vite a leggere la libreria correttamente come funzione
const html2pdf = html2pdfModule.default || html2pdfModule;

import ClientForm from '../components/ClientForm';
import ServicesList from '../components/ServicesList';
import Summary from '../components/Summary';
import PdfTemplate from '../components/PdfTemplate';
import Toast from '../components/Toast';

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
  const settings = getSettings(); // Carichiamo i settings attuali

  const [quote, setQuote] = useState<Quote>(() => {
    if (initialQuote) return { ...initialQuote };
    return { id: generateQuoteId(), createdAt: new Date().toISOString(), ...getEmptyQuote() } as Quote;
  });

  const showToast = (text: string, type: 'success' | 'info' = 'success') => {
    setToastMessage({ text, visible: true, type });
    setTimeout(() => setToastMessage(prev => ({ ...prev, visible: false })), 3000);
  };

  const handleSave = () => {
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
      showToast("Form svuotato", "info");
    }
  };

  const handleGeneratePdf = async () => {
    setIsGeneratingPdf(true);
    onSave(quote); // Salva i dati prima

    try {
      const element = document.getElementById('pdf-template-container');
      
      if (!element) {
        throw new Error("Elemento PDF non trovato nel DOM!");
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
          logging: false,
          // Questo forza il motore a ignorare i colori complessi e usare il bianco di base
          backgroundColor: '#ffffff',
          // Forza il rendering a ignorare i CSS "moderni" che non supporta
          onclone: (clonedDoc: Document) => {
            const el = clonedDoc.getElementById('pdf-template-container');
            if (el) {
              // Rimuove eventuali classi che potrebbero avere oklch rimasugli
              el.style.fontFamily = 'Arial, sans-serif';
            }
          }
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
      };

      // Genera il PDF
      await html2pdf().set(opt).from(element).save();
      
      showToast("PDF Generato con successo!");
    } catch (error) {
      console.error("Errore durante la generazione del PDF:", error);
      showToast("Errore nella generazione PDF. Controlla la console.", "info");
    } finally {
      setIsGeneratingPdf(false);
    }
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
            <p className="text-xs font-semibold text-[var(--accent)]">{quote.id}</p>
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
            whileTap={{ scale: 0.97 }} onClick={handleSave} disabled={isSaving}
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
          <ClientForm data={quote.client} onChange={(client) => setQuote({ ...quote, client })} />
          <ServicesList services={quote.services} onChange={(services) => setQuote({ ...quote, services })} />
        </div>
        <div className="lg:col-span-4 space-y-6">
          <Summary services={quote.services} discount={quote.discount} onDiscountChange={(discount) => setQuote({ ...quote, discount })} notes={quote.notes} onNotesChange={(notes) => setQuote({ ...quote, notes })} />
        </div>
      </div>

      <Toast message={toastMessage.text} isVisible={toastMessage.visible} type={toastMessage.type} />

      {/* TEMPLATE PDF NASCOSTO - Ora gli passiamo anche i settings! */}
      <div 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: -9999,
          opacity: 0,
          pointerEvents: 'none'
        }}
      >
        <PdfTemplate quote={quote} settings={settings} />
      </div>
    </div>
  );
}