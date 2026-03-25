import type { Quote, CompanySettings } from '../utils/types';

interface PdfTemplateProps {
  quote: Quote;
  settings: CompanySettings;
}

export default function PdfTemplate({ quote, settings }: PdfTemplateProps) {
  const subtotal = quote.services.reduce((acc, item) => acc + (item.qty * item.unitPrice), 0);
  const discountAmount = (subtotal * quote.discount) / 100;
  const total = subtotal - discountAmount;
  
  const dateStr = new Date(quote.createdAt).toLocaleDateString('it-IT');

  // Stili comuni per evitare OKLCH
  const borderStyle = { border: '1px solid #000000' };
  const grayBg = { backgroundColor: '#f3f4f6' };

  return (
    <div 
      id="pdf-template-container" 
      style={{ 
        backgroundColor: '#ffffff',
        color: '#000000',
        width: '210mm', 
        minHeight: '297mm', 
        padding: '15mm', 
        fontFamily: 'Arial, sans-serif',
        position: 'relative',
        boxSizing: 'border-box'
      }}
    >
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #000000', paddingBottom: '15px', marginBottom: '20px' }}>
        <div style={{ width: '66%', display: 'flex', gap: '15px' }}>
          {settings.logoUrl && (
            <img src={settings.logoUrl} alt="Logo" style={{ width: '80px', height: '80px', objectFit: 'contain' }} crossOrigin="anonymous" />
          )}
          <div>
            <p style={{ fontWeight: 'bold', fontSize: '18px', margin: '0 0 5px 0', textTransform: 'uppercase' }}>{settings.name}</p>
            <p style={{ fontWeight: '600', fontSize: '14px', margin: '0 0 10px 0', color: '#374151' }}>ANIMAZIONE ED EVENTI</p>
            <div style={{ fontSize: '10px', lineHeight: '1.2', color: '#4b5563' }}>
              <p style={{ margin: '2px 0' }}>{settings.address}</p>
              <p style={{ margin: '2px 0' }}>Tel: {settings.phone}</p>
              <p style={{ margin: '2px 0' }}>Email: {settings.email} | Web: {settings.website}</p>
              <p style={{ margin: '2px 0' }}>{settings.vat}</p>
            </div>
          </div>
        </div>
        <div style={{ width: '33%', textAlign: 'right' }}>
          <p style={{ fontSize: '10px', color: '#6b7280', margin: '0 0 5px 0' }}>COPIA CLIENTE</p>
          <div style={{ ...borderStyle, ...grayBg, padding: '10px', textAlign: 'left' }}>
            <p style={{ fontWeight: 'bold', fontSize: '12px', margin: '0 0 5px 0', textTransform: 'uppercase' }}>Preventivo / Contratto</p>
            <p style={{ fontSize: '11px', margin: '0' }}>N° {quote.id} del {dateStr}</p>
            <p style={{ fontSize: '9px', marginTop: '8px', fontStyle: 'italic', margin: '8px 0 0 0' }}>VALIDITÀ DEL PREVENTIVO 10gg</p>
          </div>
        </div>
      </div>

      {/* DATI EVENTO */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ ...borderStyle, padding: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          <div>
            <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#4b5563', margin: '0' }}>RICORRENZA</p>
            <p style={{ fontSize: '12px', fontWeight: 'bold', margin: '2px 0' }}>{quote.client.eventType.toUpperCase() || 'N/A'}</p>
          </div>
          <div>
            <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#4b5563', margin: '0' }}>DATA EVENTO</p>
            <p style={{ fontSize: '12px', fontWeight: 'bold', margin: '2px 0' }}>{quote.client.date || 'N/A'}</p>
          </div>
          <div>
            <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#4b5563', margin: '0' }}>ORARIO</p>
            <p style={{ fontSize: '12px', fontWeight: 'bold', margin: '2px 0' }}>{quote.client.time || 'N/A'}</p>
          </div>
          <div style={{ gridColumn: 'span 3', borderTop: '1px solid #e5e7eb', paddingTop: '8px' }}>
            <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#4b5563', margin: '0' }}>LOCATION</p>
            <p style={{ fontSize: '12px', fontWeight: 'bold', margin: '2px 0' }}>{quote.client.location.toUpperCase() || '_________________________'}</p>
          </div>
        </div>
      </div>

      {/* TABELLA SERVIZI */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
        <thead>
          <tr style={grayBg}>
            <th style={{ ...borderStyle, padding: '8px', textAlign: 'left', fontSize: '11px' }}>DESCRIZIONE SERVIZI</th>
            <th style={{ ...borderStyle, padding: '8px', textAlign: 'center', fontSize: '11px', width: '40px' }}>QTY</th>
            <th style={{ ...borderStyle, padding: '8px', textAlign: 'right', fontSize: '11px', width: '80px' }}>PREZZO UNIT.</th>
            <th style={{ ...borderStyle, padding: '8px', textAlign: 'right', fontSize: '11px', width: '80px' }}>TOTALE</th>
          </tr>
        </thead>
        <tbody>
          {quote.services.map((s, i) => (
            <tr key={i}>
              <td style={{ ...borderStyle, padding: '8px', fontSize: '11px' }}>{s.name}</td>
              <td style={{ ...borderStyle, padding: '8px', fontSize: '11px', textAlign: 'center' }}>{s.qty}</td>
              <td style={{ ...borderStyle, padding: '8px', fontSize: '11px', textAlign: 'right' }}>€ {s.unitPrice.toFixed(2)}</td>
              <td style={{ ...borderStyle, padding: '8px', fontSize: '11px', textAlign: 'right', fontWeight: 'bold' }}>€ {(s.qty * s.unitPrice).toFixed(2)}</td>
            </tr>
          ))}
          {/* Riempimento righe vuote per estetica se pochi servizi */}
          {quote.services.length < 8 && Array.from({ length: 8 - quote.services.length }).map((_, i) => (
            <tr key={`empty-${i}`}>
              <td style={{ ...borderStyle, padding: '12px' }}></td>
              <td style={{ ...borderStyle, padding: '12px' }}></td>
              <td style={{ ...borderStyle, padding: '12px' }}></td>
              <td style={{ ...borderStyle, padding: '12px' }}></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* NOTE */}
      {quote.notes && (
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '10px', fontWeight: 'bold', margin: '0 0 5px 0' }}>NOTE / DETTAGLI:</p>
          <div style={{ ...borderStyle, padding: '10px', fontSize: '10px', minHeight: '60px', whiteSpace: 'pre-wrap' }}>
            {quote.notes}
          </div>
        </div>
      )}

      {/* FOOTER & TOTALI */}
      <div style={{ position: 'absolute', bottom: '15mm', left: '15mm', right: '15mm', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ ...borderStyle, padding: '10px', fontSize: '11px' }}>
            <p style={{ margin: '0 0 5px 0' }}><span style={{ fontWeight: 'bold' }}>Richiesto da:</span> {quote.client.name.toUpperCase() || '_________________________'}</p>
            <p style={{ margin: '0' }}><span style={{ fontWeight: 'bold' }}>Cell:</span> {quote.client.phone || '_________________________'}</p>
          </div>
          
          <div style={{ ...borderStyle, ...grayBg, padding: '10px', fontSize: '11px' }}>
            <p style={{ fontWeight: 'bold', margin: '0 0 5px 0' }}>MODALITÀ DI PAGAMENTO</p>
            <p style={{ margin: '2px 0' }}>☑ Contanti a fine evento</p>
            <p style={{ margin: '2px 0' }}>☐ Bonifico Bancario Anticipato</p>
            <div style={{ marginTop: '8px', fontSize: '9px' }}>
              <p style={{ fontWeight: 'bold', margin: '0' }}>IBAN AZIENDALE</p>
              <p style={{ margin: '0' }}>{settings.iban}</p>
            </div>
          </div>

          <div style={{ fontSize: '9px', textAlign: 'center', borderTop: '1px solid #9ca3af', paddingTop: '10px' }}>
            <p style={{ margin: '0' }}>DOCUMENTO VALIDO SOLO SE DEBITAMENTE COMPILATO,</p>
            <p style={{ margin: '0' }}>FIRMATO E REINVIATO.</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ ...borderStyle, ...grayBg, padding: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
              <span>Subtotale:</span>
              <span>€ {subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
              <span>Sconto ({quote.discount}%):</span>
              <span>€ {discountAmount.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px', borderTop: '2px solid #000000', paddingTop: '10px' }}>
              <span>TOTALE:</span>
              <span>€ {total.toFixed(2)}</span>
            </div>
          </div>

          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <div style={{ height: '60px' }}></div> {/* Spazio per la firma */}
            <p style={{ borderTop: '1px solid #000000', display: 'inline-block', minWidth: '180px', paddingTop: '5px', fontSize: '10px' }}>
              Firma per Accettazione
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}