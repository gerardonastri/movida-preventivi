import type { Quote, CompanySettings } from '../utils/types';

interface PdfTemplateProps {
  quote: Quote;
  settings: CompanySettings;
}

interface LegacyService {
  description?: string;
  [key: string]: unknown;
}

export default function PdfTemplate({ quote, settings }: PdfTemplateProps) {
  const subtotal = quote.services.reduce((acc, item) => acc + (item.qty * item.unitPrice), 0);
  const total = subtotal - quote.discount;
  
  const dateObj = quote.client.date ? new Date(quote.client.date) : null;
  const formattedDate = dateObj 
    ? dateObj.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()
    : '___/___/______';

  const creationDate = new Date(quote.createdAt).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
  };

  return (
    <div 
      id="pdf-template-container" 
      style={{ 
        backgroundColor: '#ffffff',
        color: '#000000',
        width: '210mm', 
        minHeight: '297mm', 
        padding: '12mm 15mm', 
        fontFamily: 'Arial, Helvetica, sans-serif',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        fontSize: '11px',
        lineHeight: '1.4'
      }}
    >
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '25px' }}>
        <div style={{ width: '60%', display: 'flex', gap: '15px' }}>
          <img 
            src={settings.logoBase64 || "/logo.avif"} 
            alt="Logo" 
            style={{ width: '90px', height: '90px', objectFit: 'contain' }} 
            crossOrigin="anonymous"
          />
          <div style={{ paddingTop: '2px' }}>
            <p style={{ fontWeight: '900', fontSize: '22px', margin: '0 0 2px 0', textTransform: 'uppercase', color: '#000', letterSpacing: '-0.5px' }}>
              {settings.name}
            </p>
            <p style={{ fontWeight: 'bold', fontSize: '13px', margin: '0 0 8px 0', letterSpacing: '1px' }}>
              ANIMAZIONE ED EVENTI
            </p>
            <div style={{ fontSize: '9px', lineHeight: '1.3' }}>
              <p style={{ margin: '0' }}>{settings.address}</p>
              <p style={{ margin: '0' }}>Tel: {settings.phone}</p>
              <p style={{ margin: '0' }}>Email: {settings.email} | Web: {settings.website}</p>
              <p style={{ margin: '0' }}>{settings.vat}</p>
            </div>
          </div>
        </div>
        
        <div style={{ width: '35%', textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <p style={{ fontWeight: 'bold', fontSize: '13px', margin: '0 0 6px 0', color: '#444' }}>COPIA CLIENTE</p>
          <div style={{ border: '2px solid #000000', padding: '12px', textAlign: 'center', width: '100%' }}>
            <p style={{ fontWeight: '900', fontSize: '13px', margin: '0 0 6px 0', textTransform: 'uppercase' }}>
              {quote.documentType.toUpperCase()}
            </p>
            <p style={{ fontSize: '11px', margin: '0 0 8px 0' }}>del {creationDate}</p>
            <p style={{ fontSize: '10px', fontWeight: 'bold', margin: '0' }}>
              VALIDITÀ DEL PREVENTIVO 10gg
            </p>
          </div>
        </div>
      </div>

      {/* DATI EVENTO */}
      <div style={{ border: '1px solid #000000', padding: '12px 15px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '11px' }}>
        <div style={{ display: 'flex' }}>
          <span style={{ fontWeight: 'bold', width: '85px' }}>ricorrenza</span>
          <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{quote.client.eventType || '___________________________________'}</span>
        </div>
        <div style={{ display: 'flex' }}>
          <span style={{ fontWeight: 'bold', width: '85px' }}>In data</span>
          <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>
            {formattedDate} {quote.client.timeFrom ? `dalle ${quote.client.timeFrom}` : ''} {quote.client.timeTo ? `alle ${quote.client.timeTo}` : ''}
          </span>
        </div>
        <div style={{ display: 'flex' }}>
          <span style={{ fontWeight: 'bold', width: '85px' }}>Location</span>
          <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{quote.client.location || '___________________________________'}</span>
        </div>
      </div>

      {/* TABELLA SERVIZI */}
      <div style={{ flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px' }}>
          <thead>
            <tr>
              <th style={{ borderBottom: '2px solid #000000', padding: '5px 0', textAlign: 'left', fontSize: '11px', backgroundColor: '#f9fafb' }}>
                DESCRIZIONE SERVIZIO / ALLESTIMENTO
              </th>
              <th style={{ borderBottom: '2px solid #000000', padding: '5px 0', textAlign: 'right', fontSize: '11px', width: '120px', backgroundColor: '#f9fafb' }}>
                IMPORTO
              </th>
            </tr>
          </thead>
          <tbody>
            {quote.services.map((s, i) => {
              // Sicurezza: supporta i vecchi JSON salvati con "description" al posto di "details"
              const detailsText = s.details !== undefined ? s.details : (s as unknown as LegacyService).description;

              return (
                <tr key={i}>
                  <td style={{ borderBottom: '1px solid #e5e7eb', padding: '12px 0', verticalAlign: 'top' }}>
                    
                    {/* NOME SERVIZIO */}
                    <div style={{ fontWeight: '900', fontSize: '11px', textTransform: 'uppercase', color: '#000' }}>
                      {s.qty > 1 ? `${s.qty}X ` : ''}{s.name}
                    </div>
                    
                    {/* DETTAGLI SERVIZIO (GRIGIO) */}
                    {detailsText && (
                      <div style={{ fontSize: '9px', color: '#6b7280', marginTop: '4px', whiteSpace: 'pre-wrap', textTransform: 'uppercase' }}>
                        {detailsText}
                      </div>
                    )}

                    {/* NOTE EXTRA (AZZURRO POLVERE) */}
                    {s.notes && (
                      <div style={{ fontSize: '9px', color: '#4b6584', marginTop: '3px', whiteSpace: 'pre-wrap', textTransform: 'uppercase' }}>
                        {s.notes}
                      </div>
                    )}

                  </td>
                  <td style={{ borderBottom: '1px solid #e5e7eb', padding: '12px 0', fontSize: '12px', textAlign: 'right', verticalAlign: 'top', fontWeight: 'bold' }}>
                    {formatCurrency(s.qty * s.unitPrice)} €
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Note Documento */}
        <div style={{ fontSize: '10px', fontWeight: 'bold', marginTop: '20px', textTransform: 'uppercase' }}>
          {quote.notes ? quote.notes : 'AUTORIZZAZIONE UTILIZZO PARCO A CURA DEL CLIENTE'}
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '2px solid #000000', paddingTop: '15px' }}>
        
        <div style={{ width: '55%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ fontSize: '11px', lineHeight: '1.8' }}>
            <p style={{ margin: '0' }}>richiesto da <span style={{ fontWeight: 'bold', fontSize: '12px' }}>{quote.client.name.toUpperCase() || '_________________________________'}</span></p>
            <p style={{ margin: '0' }}>indirizzo {quote.client.address || '_________________________________________________'}</p>
            <p style={{ margin: '0' }}>Cell <span style={{ fontWeight: 'bold' }}>{quote.client.phone || '__________________'}</span> P.IVA/C.F ____________________</p>
          </div>

          <div style={{ fontSize: '10px', lineHeight: '1.5' }}>
            <div style={{ marginBottom: '6px' }}><span style={{ fontWeight: 'bold' }}>Modalità</span></div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <div style={{ border: '1px solid #000', width: '12px', height: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '10px' }}>
                {quote.paymentMethod === 'contanti' ? 'X' : ''}
              </div>
              <span>CONTANTI A FINE EVENTO</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <div style={{ border: '1px solid #000', width: '12px', height: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '10px' }}>
                {quote.paymentMethod === 'bonifico' ? 'X' : ''}
              </div>
              <span>BONIFICO BANCARIO ANTICIPATO</span>
            </div>

            <div style={{ marginBottom: '4px' }}><span style={{ fontWeight: 'bold' }}>DA COMPILARE PER FATTURA ELETTRONICA</span></div>
            <div><span style={{ fontWeight: 'bold' }}>BONIFICO BANCA INTESA</span><br/>IBAN: {settings.iban}</div>
          </div>
        </div>

        <div style={{ width: '40%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ border: '2px solid #000000', padding: '12px', fontSize: '11px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span>Totale compenso</span><span>{formatCurrency(subtotal)} €</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontWeight: 'bold' }}><span>SCONTO RISERVATO</span><span>{formatCurrency(quote.discount)} €</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span>Acconto</span><span>0,00 €</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #000', fontWeight: '900', fontSize: '14px' }}><span>Saldo</span><span>{formatCurrency(total)} €</span></div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '10px', fontWeight: 'bold', margin: '0 0 35px 0' }}>PER ACCETTAZIONE</p>
            <div style={{ borderBottom: '1px solid #000000', width: '80%', margin: '0 auto' }}></div>
          </div>
        </div>
      </div>
      
      <div style={{ textAlign: 'center', fontSize: '8px', fontWeight: 'bold', marginTop: '15px' }}>
        DOCUMENTO VALIDO SOLO SE DEBITAMENTE COMPILATO OVE NECESSARIO - FIRMATO E REINVIATO AL {settings.phone.split('-')[1]?.trim() || settings.phone}
      </div>
    </div>
  );
}