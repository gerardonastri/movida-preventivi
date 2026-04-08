import type { Quote, CompanySettings } from '../utils/types';
import { LEGAL_CLOSING } from '../utils/types';

interface PdfTemplateProps {
  quote: Quote;
  settings: CompanySettings;
}

// Compatibilità con preventivi salvati con il vecchio campo "description"
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
    return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return iso; }
};

const fmtDateLong = (iso: string) => {
  if (!iso) return '___________';
  try {
    return new Date(iso)
      .toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
      .toUpperCase();
  } catch { return iso; }
};

// ─── Colori per tipo documento (fedeli al template originale) ─────────────────
// PREVENTIVO → accento rosso  (#cc0000 / Movida red)
// CONTRATTO  → accento verde  (#1a7a1a)

const ACCENT = {
  preventivo: {
    color: '#cc0000',        // rosso Movida
    badgeText: 'PREVENTIVO',
    showValidity: true,
  },
  contratto: {
    color: '#1a7a1a',        // verde
    badgeText: 'CONTRATTO',
    showValidity: false,
  },
} as const;

// ─── Stili puri inline — NO Tailwind, NO CSS vars, NO oklch ──────────────────
// html2canvas non riesce a renderizzare CSS custom properties o color-spaces moderni.

export default function PdfTemplate({ quote, settings }: PdfTemplateProps) {
  const accent      = ACCENT[quote.documentType ?? 'preventivo'];
  const isBonifico  = quote.paymentMethod === 'bonifico';

  const subtotal      = quote.services.reduce((acc, s) => acc + (s.omaggio ? 0 : s.qty * s.unitPrice), 0);
  const itemDiscounts = quote.services.reduce((acc, s) => acc + (s.omaggio ? 0 : (s.itemDiscount || 0)), 0);
  const globalDiscount = quote.discount || 0;
  const totalDiscount  = globalDiscount + itemDiscounts;
  const total          = subtotal - totalDiscount;

  const creationDate  = fmtDate(quote.createdAt);
  const eventDateLong = fmtDateLong(quote.client.date);

  // Note: checkbox selezionate + testo libero aggiuntivo
  const allNotes: string[] = [
    ...(quote.selectedNotes ?? []),
    ...(quote.notes?.trim() ? [quote.notes.trim()] : []),
  ];

  const logoSrc = settings.logoBase64 || '/logo-preventivo.png';

  // ── Layout shell ────────────────────────────────────────────────────────────
  return (
    <div
      id="pdf-template-container"
      style={{
        backgroundColor: '#ffffff',
        color: '#000000',
        width: '210mm',
        minHeight: '297mm',
        padding: '10mm 14mm 10mm 14mm',
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
          Fedele al template: tutto su sfondo bianco, solo il badge
          ha il colore dell'accento (rosso/verde).
      ══════════════════════════════════════════════════════════════ */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '14px',
        paddingBottom: '10px',
        borderBottom: '1.5px solid #cccccc',
      }}>

        {/* ── Sinistra: logo circolare + nome + info ── */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', width: '58%' }}>

          {/* Logo — circolare come nel template originale */}
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            overflow: 'hidden',
            flexShrink: 0,
            border: '2px solid #e5e5e5',
            backgroundColor: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <img
              src={logoSrc}
              alt="Logo"
              crossOrigin="anonymous"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          </div>

          {/* Testi azienda */}
          <div style={{ paddingTop: '2px' }}>
            {/* Nome azienda — grassetto, con "in" in italic come nel template */}
            <div style={{ marginBottom: '3px' }}>
              <span style={{ fontWeight: '900', fontSize: '21px', textTransform: 'uppercase', letterSpacing: '-0.5px', color: '#000' }}>
                Movida
              </span>
              <span style={{ fontWeight: '900', fontSize: '21px', fontStyle: 'italic', color: '#000' }}>
                in
              </span>
              <span style={{ fontWeight: '900', fontSize: '21px', textTransform: 'uppercase', letterSpacing: '-0.5px', color: '#000' }}>
                Tour
              </span>
            </div>

            {/* Contatti principali — una riga */}
            <div style={{ fontSize: '8.5px', color: '#333', marginBottom: '4px' }}>
              Mobile {settings.phone.split('-')[0]?.trim() || settings.phone}
              &nbsp;&nbsp;|&nbsp;&nbsp;
              Office {settings.phone.split('-')[1]?.trim() || ''}
              &nbsp;&nbsp;|&nbsp;&nbsp;
              web {settings.website}
              &nbsp;&nbsp;|&nbsp;&nbsp;
              mail {settings.email}
            </div>

            {/* Indirizzi e dati fiscali */}
            <div style={{ fontSize: '8px', color: '#555', lineHeight: '1.5' }}>
              <div>{settings.address}</div>
              <div>{settings.vat}</div>
            </div>
          </div>
        </div>

        {/* ── Destra: "COPIA CLIENTE" + badge ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', paddingTop: '2px' }}>
          <p style={{ fontSize: '9px', color: '#888', margin: '0', letterSpacing: '1px', fontWeight: 'bold' }}>
            COPIA CLIENTE
          </p>

          {/* Badge tipo documento — solo bordo colorato, sfondo bianco */}
          <div style={{
            border: `2px solid ${accent.color}`,
            padding: '8px 16px',
            textAlign: 'center',
            minWidth: '140px',
          }}>
            <p style={{
              fontWeight: '900',
              fontSize: '14px',
              margin: '0 0 3px 0',
              letterSpacing: '1.5px',
              color: accent.color,
            }}>
              {accent.badgeText}
            </p>
            <p style={{ fontSize: '10px', margin: '0', color: '#333' }}>
              del {creationDate}
            </p>
            {accent.showValidity && (
              <p style={{
                fontSize: '9px',
                fontWeight: 'bold',
                margin: '5px 0 0 0',
                color: '#000',
                letterSpacing: '0.2px',
              }}>
                Validità preventivo 10 gg
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          DATI EVENTO — Ricorrenza | Data | Ora | Luogo
          Fedele al template: etichette brevi + riga tratteggiata
      ══════════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: '10px', fontSize: '10px' }}>

        {/* Ricorrenza */}
        <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: '5px' }}>
          <span style={{ fontWeight: 'bold', width: '90px', flexShrink: 0 }}>Ricorrenza</span>
          <span style={{
            borderBottom: '1px solid #999',
            flex: 1,
            minHeight: '14px',
            paddingLeft: '4px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
          }}>
            {quote.client.eventType || ''}
          </span>
        </div>

        {/* Data + Ora — su due colonne */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '5px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', flex: 1 }}>
            <span style={{ fontWeight: 'bold', width: '44px', flexShrink: 0 }}>Data</span>
            <span style={{
              borderBottom: '1px solid #999',
              flex: 1,
              minHeight: '14px',
              paddingLeft: '4px',
              fontWeight: 'bold',
            }}>
              {eventDateLong}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', flex: 1 }}>
            <span style={{ fontWeight: 'bold', width: '30px', flexShrink: 0 }}>Ora</span>
            <span style={{
              borderBottom: '1px solid #999',
              flex: 1,
              minHeight: '14px',
              paddingLeft: '4px',
              fontWeight: 'bold',
            }}>
              {quote.client.timeFrom && quote.client.timeTo
                ? `${quote.client.timeFrom} — ${quote.client.timeTo}`
                : quote.client.timeFrom || ''}
            </span>
          </div>
        </div>

        {/* Luogo */}
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span style={{ fontWeight: 'bold', width: '90px', flexShrink: 0 }}>Luogo</span>
          <span style={{
            borderBottom: '1px solid #999',
            flex: 1,
            minHeight: '14px',
            paddingLeft: '4px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
          }}>
            {quote.client.location || ''}
          </span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          TABELLA SERVIZI
      ══════════════════════════════════════════════════════════════ */}
      <div style={{
        flex: 1,
        border: '1px solid #cccccc',
        marginBottom: '10px',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <colgroup>
            <col style={{ width: 'auto' }} />
            <col style={{ width: quote.promoLocale ? '0' : '100px' }} />
          </colgroup>
          <tbody>
            {quote.services.length === 0 ? (
              /* Cella vuota con X decorativa se non ci sono servizi — come nel template */
              <tr>
                <td colSpan={2} style={{
                  height: '180px',
                  verticalAlign: 'middle',
                  textAlign: 'center',
                  color: '#ccc',
                  fontSize: '11px',
                  letterSpacing: '1px',
                }}>
                  — nessun servizio inserito —
                </td>
              </tr>
            ) : (
              quote.services.map((s, i) => {
                const detailsText = s.details !== undefined
                  ? s.details
                  : (s as unknown as LegacyService).description;

                const isOmaggio   = !!s.omaggio;
                const lineSubtotal = isOmaggio ? 0 : s.qty * s.unitPrice;
                const lineDiscount = isOmaggio ? 0 : (s.itemDiscount || 0);
                const lineTotal    = lineSubtotal - lineDiscount;

                return (
                  <tr key={i} style={{ borderBottom: i < quote.services.length - 1 ? '1px solid #eeeeee' : 'none' }}>

                    {/* Colonna descrizione */}
                    <td style={{ padding: '9px 8px 9px 10px', verticalAlign: 'top' }}>

                      {/* Nome servizio */}
                      <div style={{
                        fontWeight: '900',
                        fontSize: '10.5px',
                        textTransform: 'uppercase',
                        color: '#000',
                        textDecoration: isOmaggio ? 'none' : 'none',
                      }}>
                        {s.qty > 1 ? `${s.qty}X ` : ''}
                        {s.name}
                        {isOmaggio && (
                          <span style={{
                            marginLeft: '8px',
                            fontSize: '8px',
                            fontWeight: 'bold',
                            color: '#15803d',
                            backgroundColor: '#dcfce7',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            letterSpacing: '0.5px',
                          }}>
                            OMAGGIO
                          </span>
                        )}
                      </div>

                      {/* Dettagli (grigio) */}
                      {detailsText && (
                        <div style={{
                          fontSize: '8.5px',
                          color: '#6b7280',
                          marginTop: '3px',
                          whiteSpace: 'pre-wrap',
                          textTransform: 'uppercase',
                          lineHeight: '1.4',
                        }}>
                          {detailsText}
                        </div>
                      )}

                      {/* Note operative (blu) */}
                      {s.notes && (
                        <div style={{
                          fontSize: '8.5px',
                          color: '#1d4ed8',
                          marginTop: '2px',
                          whiteSpace: 'pre-wrap',
                          textTransform: 'uppercase',
                          lineHeight: '1.4',
                        }}>
                          {s.notes}
                        </div>
                      )}

                      {/* Sconto riga (rosso) */}
                      {lineDiscount > 0 && (
                        <div style={{ fontSize: '8.5px', color: '#dc2626', marginTop: '2px', fontWeight: 'bold' }}>
                          SCONTO: - {fmt(lineDiscount)} €
                        </div>
                      )}
                    </td>

                    {/* Colonna importo */}
                    {!quote.promoLocale && (
                      <td style={{
                        padding: '9px 10px 9px 0',
                        fontSize: '11px',
                        textAlign: 'right',
                        verticalAlign: 'top',
                        fontWeight: 'bold',
                        borderLeft: '1px solid #eeeeee',
                        whiteSpace: 'nowrap',
                      }}>
                        {isOmaggio ? (
                          <span style={{ color: '#15803d', fontSize: '10px' }}>€ 0,00</span>
                        ) : lineDiscount > 0 ? (
                          <div>
                            <div style={{ textDecoration: 'line-through', color: '#aaa', fontSize: '9px', fontWeight: 'normal' }}>
                              {fmt(lineSubtotal)} €
                            </div>
                            <div>€ {fmt(lineTotal)}</div>
                          </div>
                        ) : (
                          `€ ${fmt(lineTotal)}`
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          FOOTER — intestazione cliente | totali | firma
          Fedele al template originale
      ══════════════════════════════════════════════════════════════ */}
      <div style={{
        borderTop: '2px solid #000',
        paddingTop: '10px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '20px',
      }}>

        {/* ── Colonna sinistra ── */}
        <div style={{ width: '54%', display: 'flex', flexDirection: 'column', gap: '10px' }}>

          {/* Intestazione cliente */}
          <div style={{ fontSize: '9.5px', lineHeight: '1.65' }}>
            <div style={{ fontWeight: 'bold', fontSize: '10px', marginBottom: '3px' }}>INTESTAZIONE:</div>
            <div>
              <span style={{ fontWeight: 'bold' }}>
                {quote.client.name
                  ? quote.client.name.toUpperCase()
                  : 'NOME COGNOME'}
              </span>
              {' | CELL '}
              <span style={{ fontWeight: 'bold' }}>{quote.client.phone || '___________'}</span>
            </div>
            {/* C.F. / P.IVA — per fattura elettronica */}
            <div style={{ fontSize: '9px', color: '#444' }}>
              {settings.invoiceText ||
                'C.F. _______________ | P.IVA _______________'}
            </div>
            <div>
              <span style={{ fontWeight: 'bold' }}>INDIRIZZO</span>{' '}
              {quote.client.address || '_________________________________________________'}
            </div>
          </div>

          {/* Modalità di pagamento */}
          <div style={{ fontSize: '9.5px' }}>
            <div style={{ fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '5px', letterSpacing: '0.3px' }}>
              MODALITA&apos; DI PAGAMENTO
            </div>

            {quote.promoLocale ? (
              <div style={{
                border: '1.5px solid #ea580c',
                padding: '5px 10px',
                fontSize: '9.5px',
                color: '#c2410c',
                fontWeight: 'bold',
                backgroundColor: '#fff7ed',
              }}>
                PROMO LOCALE — Pagamento diretto alla struttura
              </div>
            ) : (
              <>
                {/* Checkbox CONTANTI */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '4px' }}>
                  <div style={{
                    border: '1.5px solid #000',
                    width: '12px', height: '12px',
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    fontWeight: 'bold', fontSize: '10px', flexShrink: 0,
                  }}>
                    {quote.paymentMethod === 'contanti' ? 'X' : ''}
                  </div>
                  <span>CONTANTI</span>
                </div>

                {/* Checkbox BONIFICIO */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '6px' }}>
                  <div style={{
                    border: '1.5px solid #000',
                    width: '12px', height: '12px',
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    fontWeight: 'bold', fontSize: '10px', flexShrink: 0,
                  }}>
                    {isBonifico ? 'X' : ''}
                  </div>
                  <span>BONIFICIO</span>
                </div>

                {/* Dati bancari — solo se bonifico */}
                {isBonifico && (
                  <div style={{ fontSize: '8.5px', color: '#333', marginTop: '2px' }}>
                    <div style={{ fontWeight: 'bold' }}>BONIFICO BANCA INTESA</div>
                    <div>IBAN {settings.iban}</div>
                  </div>
                )}

                {/* N.B. IVA */}
                <div style={{ fontSize: '8px', color: '#555', marginTop: '6px', fontWeight: 'bold' }}>
                  N.B I PREZZI SI INTENDONO IVA 22% ESCLUSA
                </div>
              </>
            )}
          </div>

          {/* Note a piè di pagina */}
          {allNotes.length > 0 && (
            <div style={{ fontSize: '7.5px', lineHeight: '1.6', color: '#444' }}>
              {allNotes.map((n, i) => (
                <div key={i} style={{ marginBottom: '1px' }}>• {n}</div>
              ))}
            </div>
          )}
        </div>

        {/* ── Colonna destra: box totali + firma ── */}
        <div style={{ width: '42%', display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Box totali — nascosto se promo locale */}
          {quote.promoLocale ? (
            <div style={{
              border: '2px solid #ea580c',
              padding: '14px',
              textAlign: 'center',
              backgroundColor: '#fff7ed',
            }}>
              <p style={{ fontWeight: '900', fontSize: '15px', color: '#c2410c', margin: '0', letterSpacing: '1px' }}>
                PROMO LOCALE
              </p>
              <p style={{ fontSize: '9px', color: '#9a3412', margin: '4px 0 0 0' }}>
                Pagamento diretto alla struttura
              </p>
            </div>
          ) : (
            <div style={{ border: '2px solid #000', padding: '10px 12px', fontSize: '10.5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span>TOTALE</span>
                <span style={{ fontWeight: 'bold' }}>€ {fmt(subtotal)}</span>
              </div>

              {itemDiscounts > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: '#dc2626', fontSize: '9.5px' }}>
                  <span>Sconti su servizi</span>
                  <span>- € {fmt(itemDiscounts)}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span>SCONTO RISERVATO</span>
                <span style={{ fontWeight: 'bold' }}>€ {fmt(globalDiscount)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span>ACCONTO</span>
                <span style={{ fontWeight: 'bold' }}>€10,00</span>
              </div>

              {/* Riga SALDO — in rosso/accent come nel template */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '8px',
                paddingTop: '7px',
                borderTop: '1.5px solid #000',
                fontWeight: '900',
                fontSize: '13px',
                color: accent.color,
              }}>
                <span>SALDO</span>
                <span>€ {fmt(total)}</span>
              </div>
            </div>
          )}

          {/* Firma per accettazione */}
          <div style={{ textAlign: 'center' }}>
            <p style={{
              fontSize: '9px',
              fontWeight: 'bold',
              margin: '0 0 28px 0',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              PER ACCETTAZIONE
            </p>
            <div style={{ borderBottom: '1px solid #000', width: '90%', margin: '0 auto' }} />
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SCRITTA LEGALE FINALE — sempre presente su ogni documento
      ══════════════════════════════════════════════════════════════ */}
      <div style={{
        marginTop: '10px',
        paddingTop: '7px',
        borderTop: '1px solid #dddddd',
        textAlign: 'center',
        fontSize: '7.5px',
        color: '#555',
        lineHeight: '1.5',
        fontStyle: 'italic',
      }}>
        {LEGAL_CLOSING}
      </div>
    </div>
  );
}