import type { Quote, CompanySettings } from '../utils/types';

interface PdfTemplateProps {
  quote: Quote;
  settings: CompanySettings;
}

// Interfaccia per compatibilità con vecchi dati che usano "description" invece di "details"
interface LegacyService {
  description?: string;
  [key: string]: unknown;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const fmtDate = (iso: string) => {
  if (!iso) return '___/___/______';
  try {
    return new Date(iso).toLocaleDateString('it-IT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  } catch { return iso; }
};

const fmtDateLong = (iso: string) => {
  if (!iso) return '___/___/______';
  try {
    return new Date(iso)
      .toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
      .toUpperCase();
  } catch { return iso; }
};

// ─── Costanti visive per i due tipi di documento ─────────────────────────────

const THEME = {
  preventivo: {
    headerBg:    '#1a1a2e',   // blu scuro quasi nero
    headerText:  '#ffffff',
    accentBg:    '#f0f4ff',   // sfondo tabella testate
    accentBorder:'#1a1a2e',
    badgeText:   'PREVENTIVO',
    showValidity: true,
  },
  contratto: {
    headerBg:    '#0d0d0d',   // nero puro
    headerText:  '#ffffff',
    accentBg:    '#fff8e7',   // leggermente ambrato per distinguerlo
    accentBorder:'#0d0d0d',
    badgeText:   'CONTRATTO',
    showValidity: false,
  },
} as const;

// ─── Stili inline puri — NO Tailwind, NO CSS vars, NO oklch ──────────────────
// html2canvas non riesce a renderizzare variabili CSS o color spaces moderni.

export default function PdfTemplate({ quote, settings }: PdfTemplateProps) {
  const theme       = THEME[quote.documentType ?? 'preventivo'];

  const subtotal      = quote.services.reduce((acc, s) => acc + s.qty * s.unitPrice, 0);
  const itemDiscounts = quote.services.reduce((acc, s) => acc + (s.itemDiscount || 0), 0);
  const globalDiscount = quote.discount || 0;
  const totalDiscount = globalDiscount + itemDiscounts;
  const total         = subtotal - totalDiscount;

  const creationDate  = fmtDate(quote.createdAt);
  const eventDateLong = fmtDateLong(quote.client.date);

  // Note: array selectedNotes + eventuale nota libera
  const allNotes: string[] = [
    ...(quote.selectedNotes ?? []),
    ...(quote.notes?.trim() ? [quote.notes.trim()] : []),
  ];

  // Indirizzo cliente da mostrare nel footer
  const clientAddress = quote.client.address?.trim() || '_________________________________________________';

  const invoiceText = settings.invoiceText ||
    '* DA COMPILARE PER FATTURA ELETTRONICA: P.IVA/C.F. _____________________ CODICE SDI / PEC _____________________';

  // Logo: usa base64 se disponibile, altrimenti il path locale
  const logoSrc = settings.logoBase64 || '/logo-preventivo.png';

  return (
    <div
      id="pdf-template-container"
      style={{
        backgroundColor: '#ffffff',
        color: '#000000',
        width: '210mm',
        minHeight: '297mm',
        padding: '10mm 14mm 12mm 14mm',
        fontFamily: 'Arial, Helvetica, sans-serif',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        fontSize: '10px',
        lineHeight: '1.4',
      }}
    >

      {/* ══════════════════════════════════════════════════════════════
          HEADER — logo + info azienda | badge documento
      ══════════════════════════════════════════════════════════════ */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '12px',
        paddingBottom: '10px',
        borderBottom: `2px solid ${theme.headerBg}`,
      }}>
        {/* Sinistra: logo + ragione sociale */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', width: '60%' }}>
          <img
            src={logoSrc}
            alt="Logo"
            crossOrigin="anonymous"
            style={{ width: '80px', height: '80px', objectFit: 'contain', flexShrink: 0 }}
          />
          <div style={{ paddingTop: '2px' }}>
            <p style={{ fontWeight: '900', fontSize: '20px', margin: '0 0 1px 0', textTransform: 'uppercase', letterSpacing: '-0.3px' }}>
              {settings.name}
            </p>
            <p style={{ fontWeight: 'bold', fontSize: '11px', margin: '0 0 7px 0', letterSpacing: '0.8px', color: '#444' }}>
              ANIMAZIONE ED EVENTI
            </p>
            <div style={{ fontSize: '9px', lineHeight: '1.45', color: '#555' }}>
              <div>{settings.address}</div>
              <div>Tel: {settings.phone}</div>
              <div>Email: {settings.email} | Web: {settings.website}</div>
              <div>{settings.vat}</div>
            </div>
          </div>
        </div>

        {/* Destra: badge tipo documento */}
        <div style={{ width: '35%', textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          {/* "COPIA CLIENTE" in grigio sopra */}
          <p style={{ fontSize: '9px', color: '#888', margin: '0', letterSpacing: '1px' }}>COPIA CLIENTE</p>

          {/* Badge principale */}
          <div style={{
            backgroundColor: theme.headerBg,
            color: theme.headerText,
            padding: '10px 14px',
            textAlign: 'center',
            width: '100%',
            borderRadius: '4px',
          }}>
            <p style={{ fontWeight: '900', fontSize: '15px', margin: '0 0 4px 0', letterSpacing: '1.5px' }}>
              {theme.badgeText}
            </p>
            <p style={{ fontSize: '11px', margin: '0', opacity: 0.85 }}>
              del {creationDate}
            </p>
            {theme.showValidity && (
              <p style={{ fontSize: '9px', fontWeight: 'bold', margin: '6px 0 0 0', opacity: 0.7, letterSpacing: '0.3px' }}>
                VALIDITÀ DEL PREVENTIVO 10gg
              </p>
            )}
          </div>

          {/* ID documento */}
          <p style={{ fontSize: '11px', fontWeight: 'bold', margin: '0', color: '#333' }}>
            N° {quote.id}
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          INTESTAZIONE CLIENTE (sopra la tabella, come nel template)
      ══════════════════════════════════════════════════════════════ */}
      <div style={{
        border: `1px solid ${theme.accentBorder}`,
        padding: '8px 12px',
        marginBottom: '12px',
        fontSize: '10px',
        lineHeight: '1.8',
        backgroundColor: theme.accentBg,
      }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <span style={{ fontWeight: 'bold', minWidth: '80px' }}>INTESTAZIONE:</span>
          <span style={{ fontWeight: 'bold' }}>
            {quote.client.name
              ? `${quote.client.name.toUpperCase()} | CELL ${quote.client.phone || '_____________'}`
              : '____________________________________ | CELL _____________'}
          </span>
        </div>
        {/* C.F. / P.IVA cliente — dalla nota invoiceText */}
        <div style={{ fontSize: '9px', color: '#666', marginTop: '2px' }}>
          {invoiceText}
        </div>
        <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
          <span style={{ fontWeight: 'bold', minWidth: '80px' }}>INDIRIZZO</span>
          <span>{clientAddress}</span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          DATI EVENTO
      ══════════════════════════════════════════════════════════════ */}
      <div style={{
        border: `1px solid #cccccc`,
        padding: '8px 12px',
        marginBottom: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '5px',
        fontSize: '10px',
      }}>
        <div style={{ display: 'flex' }}>
          <span style={{ fontWeight: 'bold', width: '80px' }}>ricorrenza</span>
          <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>
            {quote.client.eventType || '___________________________________'}
          </span>
        </div>
        <div style={{ display: 'flex' }}>
          <span style={{ fontWeight: 'bold', width: '80px' }}>In data</span>
          <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>
            {eventDateLong}
            {quote.client.timeFrom ? ` dalle ${quote.client.timeFrom}` : ''}
            {quote.client.timeTo   ? ` alle ${quote.client.timeTo}` : ''}
          </span>
        </div>
        <div style={{ display: 'flex' }}>
          <span style={{ fontWeight: 'bold', width: '80px' }}>Location</span>
          <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>
            {quote.client.location || '___________________________________'}
          </span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          TABELLA SERVIZI — parte centrale invariata
      ══════════════════════════════════════════════════════════════ */}
      <div style={{ flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
          <thead>
            <tr>
              <th style={{
                borderBottom: `2px solid ${theme.accentBorder}`,
                padding: '6px 0',
                textAlign: 'left',
                fontSize: '10px',
                backgroundColor: theme.accentBg,
                paddingLeft: '4px',
              }}>
                DESCRIZIONE SERVIZIO / ALLESTIMENTO
              </th>
              <th style={{
                borderBottom: `2px solid ${theme.accentBorder}`,
                padding: '6px 0',
                textAlign: 'right',
                fontSize: '10px',
                width: '110px',
                backgroundColor: theme.accentBg,
              }}>
                {quote.promoLocale ? '' : 'IMPORTO'}
              </th>
            </tr>
          </thead>
          <tbody>
            {quote.services.map((s, i) => {
              // Compatibilità: alcuni preventivi vecchi usano "description" invece di "details"
              const detailsText = s.details !== undefined
                ? s.details
                : (s as unknown as LegacyService).description;

              const lineSubtotal = s.qty * s.unitPrice;
              const lineDiscount = s.itemDiscount || 0;
              const lineTotal    = lineSubtotal - lineDiscount;

              return (
                <tr key={i}>
                  <td style={{ borderBottom: '1px solid #e5e7eb', padding: '10px 0 10px 4px', verticalAlign: 'top' }}>
                    <div style={{ fontWeight: '900', fontSize: '10.5px', textTransform: 'uppercase', color: '#000' }}>
                      {s.qty > 1 ? `${s.qty}X ` : ''}{s.name}
                    </div>
                    {detailsText && (
                      <div style={{ fontSize: '8.5px', color: '#6b7280', marginTop: '3px', whiteSpace: 'pre-wrap', textTransform: 'uppercase' }}>
                        {detailsText}
                      </div>
                    )}
                    {s.notes && (
                      <div style={{ fontSize: '8.5px', color: '#4b6584', marginTop: '2px', whiteSpace: 'pre-wrap', textTransform: 'uppercase' }}>
                        {s.notes}
                      </div>
                    )}
                    {lineDiscount > 0 && (
                      <div style={{ fontSize: '8.5px', color: '#dc2626', marginTop: '2px', fontWeight: 'bold' }}>
                        SCONTO: - {fmt(lineDiscount)} €
                      </div>
                    )}
                  </td>
                  <td style={{ borderBottom: '1px solid #e5e7eb', padding: '10px 0', fontSize: '11px', textAlign: 'right', verticalAlign: 'top', fontWeight: 'bold' }}>
                    {/* Se promo locale → niente importi */}
                    {quote.promoLocale ? (
                      <span style={{ fontSize: '9px', color: '#ea580c', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                        PROMO LOCALE
                      </span>
                    ) : lineDiscount > 0 ? (
                      <div>
                        <div style={{ textDecoration: 'line-through', color: '#9ca3af', fontSize: '9px' }}>
                          {fmt(lineSubtotal)} €
                        </div>
                        <div>{fmt(lineTotal)} €</div>
                      </div>
                    ) : (
                      `${fmt(lineTotal)} €`
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          FOOTER — pagamento | totali | firma
      ══════════════════════════════════════════════════════════════ */}
      <div style={{
        marginTop: 'auto',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderTop: `2px solid ${theme.accentBorder}`,
        paddingTop: '12px',
        gap: '20px',
      }}>

        {/* ── Colonna sinistra: cliente + pagamento ── */}
        <div style={{ width: '55%', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Modalità di pagamento */}
          <div style={{ fontSize: '10px', lineHeight: '1.7' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              MODALITÀ DI PAGAMENTO
            </div>

            {/* Se promo locale — messaggio speciale */}
            {quote.promoLocale ? (
              <div style={{
                border: '1.5px solid #ea580c',
                borderRadius: '4px',
                padding: '6px 10px',
                backgroundColor: '#fff7ed',
                fontSize: '10px',
                color: '#c2410c',
                fontWeight: 'bold',
              }}>
                PROMO LOCALE — Pagamento diretto alla struttura
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '3px' }}>
                  <div style={{
                    border: '1.5px solid #000',
                    width: '12px',
                    height: '12px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    fontWeight: 'bold',
                    fontSize: '10px',
                    flexShrink: 0,
                  }}>
                    {quote.paymentMethod === 'contanti' ? 'X' : ''}
                  </div>
                  <span>CONTANTI A FINE EVENTO</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px' }}>
                  <div style={{
                    border: '1.5px solid #000',
                    width: '12px',
                    height: '12px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    fontWeight: 'bold',
                    fontSize: '10px',
                    flexShrink: 0,
                  }}>
                    {quote.paymentMethod === 'bonifico' ? 'X' : ''}
                  </div>
                  <span>BONIFICIO</span>
                </div>
                <div style={{ fontSize: '9px', color: '#555' }}>
                  <span style={{ fontWeight: 'bold' }}>N.B I PREZZI SI INTENDONO IVA 22% ESCLUSA</span>
                </div>
                <div style={{ marginTop: '6px', fontSize: '9px', color: '#444' }}>
                  <div style={{ fontWeight: 'bold' }}>BONIFICO BANCA INTESA</div>
                  <div>IBAN: {settings.iban}</div>
                </div>
              </>
            )}
          </div>

          {/* Note a piè di pagina */}
          {allNotes.length > 0 && (
            <div style={{ fontSize: '8px', lineHeight: '1.6', color: '#444', marginTop: '2px' }}>
              {allNotes.map((n, i) => (
                <div key={i} style={{ marginBottom: '1px' }}>
                  • {n}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Colonna destra: totali + firma ── */}
        <div style={{ width: '42%', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Box totali — nascosto se promo locale */}
          {quote.promoLocale ? (
            <div style={{
              border: '2px solid #ea580c',
              padding: '14px',
              textAlign: 'center',
              borderRadius: '4px',
              backgroundColor: '#fff7ed',
            }}>
              <p style={{ fontWeight: '900', fontSize: '16px', color: '#c2410c', margin: '0', letterSpacing: '1px' }}>
                PROMO LOCALE
              </p>
              <p style={{ fontSize: '9px', color: '#9a3412', margin: '4px 0 0 0' }}>
                Pagamento diretto alla struttura
              </p>
            </div>
          ) : (
            <div style={{ border: `2px solid ${theme.accentBorder}`, padding: '12px', fontSize: '11px' }}>
              {/* Subtotale */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span>Totale compenso</span>
                <span>{fmt(subtotal)} €</span>
              </div>

              {/* Sconti su singole righe */}
              {itemDiscounts > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: '#dc2626', fontSize: '9.5px' }}>
                  <span>Sconti su servizi</span>
                  <span>- {fmt(itemDiscounts)} €</span>
                </div>
              )}

              {/* Sconto globale */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontWeight: 'bold' }}>
                <span>SCONTO RISERVATO</span>
                <span>{fmt(globalDiscount)} €</span>
              </div>

              {/* Acconto */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span>Acconto</span>
                <span>0,00 €</span>
              </div>

              {/* SALDO — riga finale in grassetto */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '8px',
                paddingTop: '8px',
                borderTop: `1.5px solid ${theme.accentBorder}`,
                fontWeight: '900',
                fontSize: '14px',
              }}>
                <span>Saldo</span>
                <span>{fmt(total)} €</span>
              </div>
            </div>
          )}

          {/* Firma per accettazione */}
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '9.5px', fontWeight: 'bold', margin: '0 0 30px 0', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              PER ACCETTAZIONE
            </p>
            <div style={{ borderBottom: `1px solid ${theme.accentBorder}`, width: '85%', margin: '0 auto' }} />
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          DISCLAIMER FINALE
      ══════════════════════════════════════════════════════════════ */}
      <div style={{ textAlign: 'center', fontSize: '7.5px', fontWeight: 'bold', marginTop: '12px', color: '#666', letterSpacing: '0.2px' }}>
        DOCUMENTO VALIDO SOLO SE DEBITAMENTE COMPILATO OVE NECESSARIO — FIRMATO E REINVIATO AL{' '}
        {settings.phone.includes('-') ? settings.phone.split('-')[1]?.trim() : settings.phone}
      </div>
    </div>
  );
}