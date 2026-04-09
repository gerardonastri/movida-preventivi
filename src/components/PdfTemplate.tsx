import React from 'react';
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

// ─── Colori per tipo documento ───────────────────────────────────────────────
// PREVENTIVO → rosso Movida (#cc2200)
// CONTRATTO  → verde scuro  (#1a7a1a)

const ACCENT = {
  preventivo: {
    color: '#cc2200',
    badgeText: 'PREVENTIVO',
    showValidity: true,
  },
  contratto: {
    color: '#1a7a1a',
    badgeText: 'CONTRATTO',
    showValidity: false,
  },
} as const;

// ─── Font Century Gothic ─────────────────────────────────────────────────────
// Ora carica esplicitamente il file normale e quello bold

const FONT_FACE_STYLE = `
  @font-face {
    font-family: 'CenturyGothic';
    src: url('/font.ttf') format('truetype');
    font-weight: normal;
    font-style: normal;
  }
  @font-face {
    font-family: 'CenturyGothic';
    src: url('/font-bold.ttf') format('truetype');
    font-weight: bold;
    font-style: normal;
  }
  @font-face {
    font-family: 'CenturyGothic';
    src: url('/font-bold.ttf') format('truetype');
    font-weight: 900;
    font-style: normal;
  }
  #pdf-template-container * {
    font-family: 'CenturyGothic', 'Century Gothic', 'AppleGothic', Arial, sans-serif !important;
  }
`;

// ─── Auto-scaling: garantisce 1 pagina anche con molti servizi ───────────────
// I valori di padding e font vengono ridotti proporzionalmente.

function getScale(serviceCount: number): number {
  if (serviceCount <= 6)  return 1.00;
  if (serviceCount <= 9)  return 0.92;
  if (serviceCount <= 12) return 0.84;
  if (serviceCount <= 15) return 0.77;
  return 0.70;
}

export default function PdfTemplate({ quote, settings }: PdfTemplateProps) {
  const accent     = ACCENT[quote.documentType ?? 'preventivo'];
  const isBonifico = quote.paymentMethod === 'bonifico';
  const scale      = getScale(quote.services.length);

  const subtotal       = quote.services.reduce((acc, s) => acc + (s.omaggio ? 0 : s.qty * s.unitPrice), 0);
  const itemDiscounts  = quote.services.reduce((acc, s) => acc + (s.omaggio ? 0 : (s.itemDiscount || 0)), 0);
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

  // Helper: applica la scala ai font size (restituisce stringa px)
  const fs = (base: number) => `${Math.round(base * scale)}px`;
  // Helper: scala i gap/padding numerici
  const sp = (base: number) => `${Math.round(base * scale)}px`;

  // Parse dati azienda dall'address string
  const addressParts = settings.address.includes('|')
    ? settings.address.split('|').map(p => p.trim())
    : [settings.address];

  const sedeLegale    = addressParts[0]?.replace(/sede legale[:\s]*/i, '').trim() ?? '';
  const sedeLogistica = addressParts[1]?.replace(/logistica[:\s]*/i, '').trim() ?? '';

  // Parse phone: "338.1234567 - 089.123456" → Mobile=338..., Office=089...
  const phoneParts  = settings.phone.split('-').map(p => p.trim());
  const mobilePhone = phoneParts[0] ?? settings.phone;
  const officePhone = phoneParts[1] ?? '';

  // Parse vat: "P.IVA 03... | CCIAA 312... | ENPALS 560..."
  const vatParts = settings.vat.split('|').map(p => p.trim());

  return (
    <div id="pdf-template-container">
      <style dangerouslySetInnerHTML={{ __html: FONT_FACE_STYLE }} />

      <div style={{
        backgroundColor: '#ffffff',
        color: '#000000',
        width: '210mm',
        padding: `${8 * scale}mm 13mm ${8 * scale}mm 13mm`,
        fontFamily: "'CenturyGothic', 'Century Gothic', 'AppleGothic', Arial, sans-serif",
        boxSizing: 'border-box' as const,
        display: 'flex',
        flexDirection: 'column' as const,
        fontSize: fs(11), // Font generale aumentato da 10 a 11
        lineHeight: '1.4',
      }}>

        {/* ══════════════════════════════════════════════════════════════
            HEADER — logo + info azienda | badge documento
        ══════════════════════════════════════════════════════════════ */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: sp(14),
          paddingBottom: sp(10),
          borderBottom: '1.5px solid #cccccc',
        }}>

          {/* Sinistra: logo + testi azienda */}
          <div style={{ display: 'flex', gap: sp(12), alignItems: 'flex-start', width: '62%' }}>

            <img
              src={logoSrc}
              alt="Logo MovidainTour"
              crossOrigin="anonymous"
              style={{
                width: `${Math.round(80 * scale)}px`,
                height: `${Math.round(80 * scale)}px`,
                objectFit: 'cover',
                borderRadius: '50%',
                flexShrink: 0,
                display: 'block',
              }}
            />

            {/* Testi azienda */}
            <div style={{ paddingTop: '1px' }}>

              {/* Titolo "MovidainTour" */}
              <div style={{ marginBottom: sp(5), lineHeight: 1 }}>
                <span style={{
                  fontWeight: '900',
                  fontSize: fs(23), // Aumentato da 21 a 23
                  color: '#000000',
                  fontStyle: 'normal',
                  letterSpacing: '-0.3px',
                }}>Movida</span>
                <span style={{
                  fontWeight: '900',
                  fontSize: fs(23),
                  color: accent.color,
                  fontStyle: 'italic',
                }}>in</span>
                <span style={{
                  fontWeight: '900',
                  fontSize: fs(23),
                  color: '#000000',
                  fontStyle: 'normal',
                  letterSpacing: '-0.3px',
                }}>Tour</span>
              </div>

              {/* Riga contatti */}
              <div style={{ fontSize: fs(9.5), color: '#222', marginBottom: sp(4), lineHeight: 1.6 }}>
                <span style={{ fontWeight: 'bold' }}>Mobile</span>{' '}{mobilePhone}
                {'  |  '}
                <span style={{ fontWeight: 'bold' }}>Office</span>{' '}{officePhone}
                <br />
                <span style={{ fontWeight: 'bold' }}>web</span>{' '}{settings.website}
                {'  |  '}
                <span style={{ fontWeight: 'bold' }}>mail</span>{' '}{settings.email}
              </div>

              {/* Sedi + dati fiscali */}
              <div style={{ fontSize: fs(9), color: '#333', lineHeight: 1.55 }}>
                {sedeLegale && (
                  <div>
                    <span style={{ fontWeight: 'bold' }}>Sede Legale</span>{' '}{sedeLegale}
                  </div>
                )}
                {sedeLogistica && (
                  <div>
                    <span style={{ fontWeight: 'bold' }}>Sede Logisitica</span>{' '}{sedeLogistica}
                  </div>
                )}
                <div style={{ marginTop: '1px' }}>
                  {vatParts.map((part, i) => {
                    const m = part.match(/^([A-Za-z./\s]+)\s+(.+)$/);
                    return (
                      <span key={i}>
                        {i > 0 && '  |  '}
                        {m
                          ? <><span style={{ fontWeight: 'bold' }}>{m[1].trim()}</span>{' '}{m[2].trim()}</>
                          : part
                        }
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Destra: COPIA CLIENTE + badge tipo documento */}
          <div style={{
            display: 'flex',
            flexDirection: 'column' as const,
            alignItems: 'flex-end',
            gap: sp(6),
            paddingTop: '2px',
          }}>
            <p style={{
              fontSize: fs(10), // Aumentato da 9 a 10
              color: '#888',
              margin: '0',
              letterSpacing: '1px',
              fontWeight: 'bold',
            }}>COPIA CLIENTE</p>

            <div style={{
              border: `2px solid ${accent.color}`,
              padding: `${sp(8)} ${sp(16)}`,
              textAlign: 'center' as const,
              minWidth: '130px',
            }}>
              <p style={{
                fontWeight: '900',
                fontSize: fs(16), // Aumentato da 14 a 16
                margin: `0 0 ${sp(3)} 0`,
                letterSpacing: '1.5px',
                color: accent.color,
              }}>{accent.badgeText}</p>
              <p style={{ fontSize: fs(11), margin: '0', color: '#333' }}>
                del {creationDate}
              </p>
              {accent.showValidity && (
                <p style={{
                  fontSize: fs(9.5),
                  fontWeight: 'bold',
                  margin: `${sp(4)} 0 0 0`,
                  color: '#000',
                }}>
                  Validità preventivo 10 gg
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            DATI EVENTO
        ══════════════════════════════════════════════════════════════ */}
        <div style={{ 
          marginBottom: sp(12), 
          fontSize: fs(11), // Aumentato
          display: 'flex',
          flexDirection: 'column' as const,
          gap: sp(5)
        }}>
          <div style={{ display: 'flex' }}>
            <span style={{ fontWeight: 'bold', width: '90px', flexShrink: 0 }}>Ricorrenza:</span>
            <span style={{ fontWeight: 'normal', textTransform: 'uppercase' as const }}>
              {quote.client.eventType || '-'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ display: 'flex', flex: 2 }}>
              <span style={{ fontWeight: 'bold', width: '90px', flexShrink: 0 }}>Data:</span>
              <span style={{ fontWeight: 'normal', textTransform: 'uppercase' as const }}>
                {eventDateLong || '-'}
              </span>
            </div>
            <div style={{ display: 'flex', flex: 1 }}>
              <span style={{ fontWeight: 'bold', width: '40px', flexShrink: 0 }}>Ora:</span>
              <span style={{ fontWeight: 'normal' }}>
                {quote.client.timeFrom && quote.client.timeTo
                  ? `${quote.client.timeFrom} — ${quote.client.timeTo}`
                  : (quote.client.timeFrom || '-')}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex' }}>
            <span style={{ fontWeight: 'bold', width: '90px', flexShrink: 0 }}>Luogo:</span>
            <span style={{ fontWeight: 'normal', textTransform: 'uppercase' as const }}>
              {quote.client.location || '-'}
            </span>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            TABELLA SERVIZI
        ══════════════════════════════════════════════════════════════ */}
        <div style={{ marginBottom: sp(8) }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{
                  borderBottom: '2px solid #000000',
                  padding: `${sp(5)} 0 ${sp(5)} 4px`,
                  textAlign: 'left' as const,
                  fontSize: fs(11),
                  fontWeight: 'bold',
                  backgroundColor: '#f9fafb',
                }}>
                  DESCRIZIONE SERVIZIO / ALLESTIMENTO
                </th>
                {!quote.promoLocale && (
                  <th style={{
                    borderBottom: '2px solid #000000',
                    padding: `${sp(5)} 0`,
                    textAlign: 'right' as const,
                    fontSize: fs(11),
                    fontWeight: 'bold',
                    width: '110px',
                    backgroundColor: '#f9fafb',
                  }}>
                    IMPORTO
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {quote.services.length === 0 ? (
                <tr>
                  <td colSpan={2} style={{
                    height: '100px',
                    verticalAlign: 'middle' as const,
                    textAlign: 'center' as const,
                    color: '#ccc',
                    fontSize: fs(11),
                  }}>
                    — nessun servizio inserito —
                  </td>
                </tr>
              ) : (
                quote.services.map((s, i) => {
                  const detailsText = s.details !== undefined
                    ? s.details
                    : (s as unknown as LegacyService).description;

                  const isOmaggio    = !!s.omaggio;
                  const lineSubtotal = isOmaggio ? 0 : s.qty * s.unitPrice;
                  const lineDiscount = isOmaggio ? 0 : (s.itemDiscount || 0);
                  const lineTotal    = lineSubtotal - lineDiscount;
                  const hasNotes     = !!s.notes;

                  return (
                    <React.Fragment key={i}>
                      <tr
                        style={{
                          borderBottom: (i < quote.services.length - 1 && !hasNotes)
                            ? '1px solid #e5e7eb'
                            : 'none',
                        }}
                      >
                        {/* Colonna descrizione */}
                        <td style={{ 
                          padding: `${sp(9)} 0 ${hasNotes ? '2px' : sp(9)} 4px`, 
                          verticalAlign: 'top' as const 
                        }}>

                          {/* Nome */}
                          <div style={{
                            fontWeight: '900',
                            fontSize: fs(11.5), // Aumentato da 10.5
                            textTransform: 'uppercase' as const,
                            color: '#000',
                          }}>
                            {s.qty > 1 ? `${s.qty}X ` : ''}
                            {s.name}
                            {isOmaggio && (
                              <span style={{
                                marginLeft: '8px',
                                fontSize: fs(9),
                                fontWeight: 'bold',
                                color: '#15803d',
                                backgroundColor: '#dcfce7',
                                padding: '1px 5px',
                                borderRadius: '3px',
                              }}>
                                OMAGGIO
                              </span>
                            )}
                          </div>

                          {/* Dettagli */}
                          {detailsText && (
                            <div style={{
                              fontSize: fs(9.5), // Aumentato da 8.5
                              color: '#6b7280',
                              marginTop: '3px',
                              whiteSpace: 'pre-wrap',
                              textTransform: 'uppercase' as const,
                              lineHeight: '1.4',
                            }}>
                              {detailsText}
                            </div>
                          )}

                          {/* Sconto riga */}
                          {lineDiscount > 0 && (
                            <div style={{
                              fontSize: fs(9.5),
                              color: '#dc2626',
                              marginTop: '2px',
                              fontWeight: 'bold',
                            }}>
                              SCONTO: - {fmt(lineDiscount)} €
                            </div>
                          )}
                        </td>

                        {/* Colonna importo */}
                        {!quote.promoLocale && (
                          <td style={{
                            padding: `${sp(9)} 10px ${hasNotes ? '2px' : sp(9)} 0`,
                            fontSize: fs(12), // Aumentato da 11
                            textAlign: 'right' as const,
                            verticalAlign: 'top' as const,
                            fontWeight: 'bold',
                            borderLeft: '1px solid #e5e7eb',
                            whiteSpace: 'nowrap',
                          }}>
                            {isOmaggio ? (
                              <span style={{ color: '#15803d', fontSize: fs(11) }}>€ 0,00</span>
                            ) : lineDiscount > 0 ? (
                              <div>
                                <div style={{
                                  textDecoration: 'line-through',
                                  color: '#aaa',
                                  fontSize: fs(10), // Aumentato da 9
                                  fontWeight: 'normal',
                                }}>
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

                      {/* Riga Note del Servizio */}
                      {hasNotes && (
                        <tr style={{
                          borderBottom: i < quote.services.length - 1
                            ? '1px solid #e5e7eb'
                            : 'none',
                        }}>
                          <td colSpan={quote.promoLocale ? 1 : 2} style={{ 
                            padding: `0 0 ${sp(9)} 4px`,
                          }}>
                            <div style={{
                              fontSize: fs(9.5), // Aumentato
                              color: '#1d4ed8',
                              whiteSpace: 'pre-wrap',
                              lineHeight: '1.4',
                            }}>
                              <span style={{ fontWeight: 'bold' }}>NOTE: </span>
                              <span style={{ textTransform: 'uppercase' as const }}>{s.notes}</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>


        {/* ══════════════════════════════════════════════════════════════
            FOOTER
        ══════════════════════════════════════════════════════════════ */}
        <div style={{
          borderTop: '2px solid #000',
          paddingTop: sp(10),
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '20px',
          marginTop: 'auto',
        }}>

          {/* Colonna sinistra */}
          <div style={{ width: '54%', display: 'flex', flexDirection: 'column' as const, gap: sp(10) }}>

            {/* Intestazione cliente */}
            <div style={{ fontSize: fs(10.5), lineHeight: '1.65' }}>
              <div style={{ fontWeight: 'bold', fontSize: fs(11), marginBottom: '3px' }}>
                INTESTAZIONE:
              </div>
              <div>
                <span style={{ fontWeight: 'bold' }}>
                  {quote.client.name ? quote.client.name.toUpperCase() : 'NOME COGNOME'}
                </span>
                {' | CELL '}
                <span style={{ fontWeight: 'bold' }}>{quote.client.phone || '___________'}</span>
              </div>
              <div style={{ fontSize: fs(9.5), color: '#444' }}>
                {settings.invoiceText || 'C.F. _______________ | P.IVA _______________'}
              </div>
              <div>
                <span style={{ fontWeight: 'bold' }}>INDIRIZZO</span>{' '}
                {quote.client.address || '_________________________________________________'}
              </div>
            </div>

            {/* Modalità di pagamento */}
            <div style={{ fontSize: fs(10.5) }}>
              <div style={{
                fontWeight: 'bold',
                fontSize: fs(11),
                textTransform: 'uppercase' as const,
                marginBottom: sp(5),
                letterSpacing: '0.3px',
              }}>
                MODALITA&apos; DI PAGAMENTO
              </div>

              {quote.promoLocale ? (
                <div style={{
                  border: '1.5px solid #888888',
                  padding: `${sp(6)} ${sp(10)}`,
                  fontSize: fs(10.5),
                  color: '#333333',
                  fontWeight: 'bold',
                  backgroundColor: '#f0f0f0',
                }}>
                  PROMO LOCALE — Pagamento diretto alla struttura
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '4px' }}>
                    <div style={{
                      border: '1.5px solid #000',
                      width: '13px', height: '13px',
                      display: 'flex', justifyContent: 'center', alignItems: 'center',
                      fontWeight: 'bold', fontSize: '11px', flexShrink: 0,
                    }}>
                      {quote.paymentMethod === 'contanti' ? 'X' : ''}
                    </div>
                    <span>CONTANTI</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: sp(6) }}>
                    <div style={{
                      border: '1.5px solid #000',
                      width: '13px', height: '13px',
                      display: 'flex', justifyContent: 'center', alignItems: 'center',
                      fontWeight: 'bold', fontSize: '11px', flexShrink: 0,
                    }}>
                      {isBonifico ? 'X' : ''}
                    </div>
                    <span>BONIFICIO</span>
                  </div>

                  {isBonifico && (
                    <div style={{ fontSize: fs(9.5), color: '#333', marginTop: '2px' }}>
                      <div style={{ fontWeight: 'bold' }}>BONIFICO BANCA INTESA</div>
                      <div>IBAN {settings.iban}</div>
                    </div>
                  )}

                  <div style={{
                    fontSize: fs(9.5),
                    color: '#555',
                    marginTop: sp(5),
                    fontWeight: 'bold',
                  }}>
                    N.B I PREZZI SI INTENDONO IVA 22% ESCLUSA
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Colonna destra */}
          <div style={{ width: '42%', display: 'flex', flexDirection: 'column' as const, gap: sp(14) }}>

            {quote.promoLocale ? (
              <div style={{
                border: '2px solid #888888',
                padding: sp(14),
                textAlign: 'center' as const,
                backgroundColor: '#f0f0f0',
              }}>
                <p style={{
                  fontWeight: '900',
                  fontSize: fs(15),
                  color: '#333333',
                  margin: '0',
                  letterSpacing: '1px',
                }}>
                  PROMO LOCALE
                </p>
                <p style={{ fontSize: fs(10), color: '#555', margin: `${sp(4)} 0 0 0` }}>
                  Pagamento diretto alla struttura
                </p>
              </div>
            ) : (
              <div style={{ border: '2px solid #000', padding: `${sp(10)} ${sp(12)}`, fontSize: fs(11.5) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: sp(5) }}>
                  <span>TOTALE</span>
                  <span style={{ fontWeight: 'bold' }}>€ {fmt(subtotal)}</span>
                </div>

                {itemDiscounts > 0 && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: sp(4),
                    color: '#dc2626',
                    fontSize: fs(10.5),
                  }}>
                    <span>Sconti su servizi</span>
                    <span>- € {fmt(itemDiscounts)}</span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: sp(5) }}>
                  <span>SCONTO RISERVATO</span>
                  <span style={{ fontWeight: 'bold' }}>€ {fmt(globalDiscount)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: sp(5) }}>
                  <span>ACCONTO</span>
                  <span style={{ fontWeight: 'bold' }}>€ 0,00</span>
                </div>

                {/* SALDO */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: sp(7),
                  paddingTop: sp(7),
                  borderTop: '1.5px solid #000',
                  fontWeight: '900',
                  fontSize: fs(14.5), // Aumentato da 13
                  color: accent.color,
                }}>
                  <span>SALDO</span>
                  <span>€ {fmt(total)}</span>
                </div>
              </div>
            )}

            {/* Firma */}
            <div style={{ textAlign: 'center' as const }}>
              <p style={{
                fontSize: fs(10),
                fontWeight: 'bold',
                margin: `0 0 ${sp(28)} 0`,
                textTransform: 'uppercase' as const,
                letterSpacing: '0.5px',
              }}>
                PER ACCETTAZIONE
              </p>
              <div style={{ borderBottom: '1px solid #000', width: '90%', margin: '0 auto' }} />
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            NOTE GLOBALI
        ══════════════════════════════════════════════════════════════ */}
        {allNotes.length > 0 && (
          <div style={{
            marginTop: sp(15),
            paddingTop: sp(8),
            borderTop: '1px dashed #cccccc',
            fontSize: fs(9.5), // Aumentato da 8.5
            lineHeight: '1.7',
            color: '#333333',
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: sp(3), fontSize: fs(10) }}>
              NOTE AGGIUNTIVE:
            </div>
            {allNotes.map((n, i) => (
              <div key={i} style={{ display: 'flex', gap: '5px', marginBottom: '1px' }}>
                <span style={{ fontWeight: 'bold', flexShrink: 0 }}>•</span>
                <span>{n}</span>
              </div>
            ))}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            SCRITTA LEGALE FINALE
        ══════════════════════════════════════════════════════════════ */}
        <div style={{
          marginTop: sp(10),
          paddingTop: sp(6),
          borderTop: '1px solid #dddddd',
          textAlign: 'center' as const,
          fontSize: fs(9), // Aumentato da 8
          color: '#555',
          lineHeight: '1.5',
          fontStyle: 'italic',
        }}>
          {LEGAL_CLOSING}
        </div>

      </div>
    </div>
  );
}