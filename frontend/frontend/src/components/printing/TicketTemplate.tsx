
import type { Ref } from 'react';
import Barcode from 'react-barcode';
import type { TicketCaisse, PharmacySettings, FactureProduit, PaymentDetails } from '../../types';
import { formatNumber } from '../../utils/formatters';
import { useTranslation } from 'react-i18next';
import { useDocumentLocale } from '../../context/PharmacySettingsContext';

interface TicketTemplateProps {
  ticket: TicketCaisse;
  settings: PharmacySettings;
  ref?: Ref<HTMLDivElement>;
}

const formatDate = (dateStr: string, locale: string) => {
    try {
        return new Date(dateStr).toLocaleString(locale, {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch {
        return dateStr;
    }
};

export const TicketTemplate = ({ ticket, settings, ref }: TicketTemplateProps) => {
  const { lang: docLang, locale: docLocale } = useDocumentLocale();
  const { t } = useTranslation('printing', { lng: docLang });

  const formatM = (val: number | string) => formatNumber(Math.round(Number(val)), 0, docLocale);

  const getProductName = (p: FactureProduit) => {
    if (!p) return t('ticket.unknown_article');
    if (typeof p.produit === 'object') return p.produit.name;
    return p.produit_nom || `${t('ticket.product')} #${p.produit || '?'}`;
  };

  const getModeLabel = (mode: string) => {
      return t(`ticket.payment_modes.${mode}`, { defaultValue: mode?.toUpperCase() || 'N/A' });
  };

  const facture = typeof ticket.facture === 'object' ? ticket.facture : null;

  // Pour les ventes en tiers payant (client professionnel), on distingue explicitement
  // ce que le client règle (part patient) de ce qui reste à la charge de l'assurance
  // (part assurance, en compte), plutôt que d'afficher uniquement le mode de paiement brut.
  const isTiersPayant = facture?.client_type === 'PROFESSIONNEL';

  const getPaymentRowLabel = (paiement: PaymentDetails) => {
      if (isTiersPayant && paiement.part_assurance != null && Number(paiement.part_assurance) > 0) {
          return t('ticket.part_assurance_row', { mode: getModeLabel(paiement.mode) });
      }
      if (isTiersPayant && paiement.part_patient != null && Number(paiement.part_patient) > 0) {
          return t('ticket.part_patient_row', { mode: getModeLabel(paiement.mode) });
      }
      return getModeLabel(paiement.mode);
  };
  const produits = facture?.produits || [];
  const totalTTC = Math.round(Number(ticket.montant || facture?.total_ttc || 0));
  const totalTVA = facture ? Math.round(Number(facture.total_tva || 0)) : 0;
  const totalHT = totalTTC - totalTVA;
  const remise = facture ? Number(facture.remise) : 0;
  const ticketWidth = settings.ticket_paper_width || 80;
  
  const clientName = ticket.client_name 
      || facture?.client_name_override 
      || facture?.client_name 
      || (facture?.client && typeof facture.client === 'object' && 'name' in facture.client ? String((facture.client as Record<string, unknown>).name) : null)
      || t('invoice.walk_in_customer');

  // Le code-barres doit correspondre au numéro de facture affiché.
  // ticket.facture peut être juste un id ; ticket.facture_numero est la valeur texte fiable.
  const barcodeValue = ticket.facture_numero || facture?.numero_facture || '';
  const showBarcode = barcodeValue.length > 0;

  return (
    <div 
      ref={ref} 
      data-theme="light"
      className="p-1 bg-base-100 text-black font-sans text-caption leading-tight print:p-0" 
      style={{ 
        width: '100%', 
        maxWidth: `${ticketWidth}mm`,
        margin: '0 auto',
        overflow: 'hidden',
        wordBreak: 'break-word' as const,
      }}
    >
      
      {/* HEADER */}
      <div className="text-center mb-2">
        {settings.logo && (
          <div className="mb-2">
            <img src={settings.logo} alt="Logo" className="h-12 inline-block grayscale object-contain" />
          </div>
        )}
        <h2 className="mb-1 text-sm font-bold uppercase leading-none tracking-tight">
            {settings.pharmacy_name || t('ticket.invoice')}
        </h2>
        <div className="mb-2 border-b border-black/25" style={{ width: '66.666%', marginLeft: 'auto', marginRight: 'auto' }}></div>
        <div className="text-micro leading-tight">
            {settings.address && <p className="mb-1 font-medium">{settings.address}</p>}
            <div className="font-mono text-[8px]">
               {(settings.phone || settings.phone2) && <div>{t('invoice.tel')}: {settings.phone}{settings.phone2 ? ` / ${settings.phone2}` : ''}</div>}
               {settings.email && <div>{t('invoice.email', { defaultValue: 'Email' })}: {settings.email}</div>}
               {settings.niu && <div>{t('invoice.niu')}: {settings.niu}</div>}
               {settings.registre_commerce && <div>{t('invoice.rc')}: {settings.registre_commerce}</div>}
            </div>
            {settings.receipt_header && <p className="mt-1 whitespace-pre-line">{settings.receipt_header}</p>}
        </div>
      </div>

      {/* TICKET INFO */}
      <div className="my-2 space-y-1 border-b border-black/20 pb-2">
          {ticket.is_duplicate && (
              <div className="text-center font-black text-xs uppercase mb-1 underline">
                  *** {t('ticket.duplicate')} ***
              </div>
          )}
          
          <table className="w-full text-micro font-mono">
            <tbody>
              <tr>
                <td className="font-medium uppercase">{t('ticket.ticket_no')}</td>
                <td className="text-right font-medium">{barcodeValue || `#${ticket.id}`}</td>
              </tr>
              <tr>
                <td>{t('invoice.date')}</td>
                <td className="text-right">{formatDate(ticket.date_paiement, docLocale)}</td>
              </tr>
              <tr>
                <td className="pt-1 font-medium uppercase">{t('invoice.customer')}</td>
                <td className="pt-1 text-right text-caption font-medium uppercase">{clientName}</td>
              </tr>
              {ticket.client_solde_depot && Number(ticket.client_solde_depot) > 0 && (
                <tr className="mt-1 border-t border-black/20">
                  <td className="py-1 font-medium uppercase">{t('invoice.remaining_deposit')}</td>
                  <td className="py-1 text-right text-caption font-medium">{formatM(ticket.client_solde_depot)}</td>
                </tr>
              )}
              {ticket.client_points_fidelite !== undefined && ticket.client_points_fidelite !== null && (
                <tr className={ticket.client_solde_depot && Number(ticket.client_solde_depot) > 0 ? "" : "mt-1 border-t border-black/20"}>
                  <td className="py-1 font-medium uppercase">{t('ticket.points_fidelity')}</td>
                  <td className="py-1 text-right text-caption font-medium">{ticket.client_points_fidelite} {t('ticket.pts')}</td>
                </tr>
              )}
              <tr>
                <td className="pt-1">{t('ticket.seller')}</td>
                <td className="pt-1 text-right uppercase">{facture?.created_by_name || t('invoice.na')}</td>
              </tr>
              <tr>
                <td className="">{t('ticket.cashier')}</td>
                <td className="text-right uppercase">{ticket.user_details?.username || t('ticket.na')}</td>
              </tr>
            </tbody>
          </table>
      </div>

      {/* ITEMS TABLE */}
      <div className="mb-2">
          <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr className="border-b border-black/30 text-micro font-semibold uppercase">
                <th className="py-1 text-left" style={{ width: '55%' }}>{t('invoice.designation')}</th>
                <th className="py-1 text-center" style={{ width: '15%' }}>{t('ticket.qty')}</th>
                <th className="py-1 text-right" style={{ width: '30%' }}>{t('ticket.total')}</th>
              </tr>
            </thead>
            <tbody className="text-caption">
              {produits.map((p: FactureProduit, _idx: number) => {
                const qty = Math.abs(p.quantity);
                const price = Number(p.selling_price || 0);
                const lineTotal = qty * price;
                
                return (
                  <tr key={p.id ?? p.produit ?? `row-${p.produit_nom ?? p.lot}`}>
                    <td className="py-1 align-top leading-tight overflow-hidden">
                        <div className="font-medium uppercase" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{getProductName(p)}</div>
                        <div className="text-[8px] font-mono italic">
                            {qty} x {formatM(price)}
                        </div>
                    </td>
                    <td className="py-1 text-center align-top font-mono">{qty}</td>
                    <td className="py-1 text-right align-top font-mono font-medium">{formatM(lineTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
      </div>

      {/* TOTALS */}
      <div className="mt-2 space-y-1">
        {remise > 0 && (
            <div className="flex justify-between text-micro font-bold">
                <span>{t('ticket.subtotal_label')}</span>
                <span className="font-mono">{formatM(totalTTC + remise)}</span>
            </div>
        )}
        
        {remise > 0 && (
            <div className="flex justify-between text-caption font-medium">
                <span>{t('ticket.discount_minus')}</span>
                <span className="font-mono">-{formatM(remise)}</span>
            </div>
        )}

        <div className="flex items-center justify-between border-y border-black/30 py-1.5 font-semibold">
            <span className="text-caption uppercase tracking-tight">{t('ticket.net_a_payer_cfa')}</span>
            <span className="font-mono text-sm tabular-nums">
                {formatM(totalTTC)}
            </span>
        </div>

        {(ticket.total_lettres || facture?.total_lettres) && (
            <div className="border-b border-black/20 py-1.5 text-center text-micro font-medium italic uppercase">
                {ticket.total_lettres || facture?.total_lettres}
            </div>
        )}

        {/* PAYMENTS */}
        <div className="pt-2">
          <table className="w-full text-micro">
            <tbody>
              {ticket.paiements_details && ticket.paiements_details.length > 0 ? (
                  ticket.paiements_details.map((paiement: PaymentDetails, _idx) => (
                      <tr key={paiement.mode ?? `pmt-${paiement.montant}`}>
                          <td className="font-medium uppercase">[{getPaymentRowLabel(paiement)}]</td>
                          <td className="text-right font-mono font-medium">{formatM(paiement.montant)}</td>
                      </tr>
                  ))
              ) : (
                  <tr>
                       <td className="font-medium uppercase">[{getModeLabel(ticket.mode_paiement)}]</td>
                       <td className="text-right font-mono font-medium">{formatM(totalTTC)}</td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* CHANGE */}
        {(Number(ticket.montant_verse) > 0 || Number(ticket.rendu) > 0) && (
          <div className="mt-2 space-y-1 border-t border-black/20 pt-2">
            {Number(ticket.montant_verse) > 0 && (
                <div className="flex justify-between text-micro">
                    <span className="uppercase italic">{t('ticket.cash_received')}</span>
                    <span className="font-mono font-bold">{formatM(ticket.montant_verse || 0)}</span>
                </div>
            )}
            {Number(ticket.rendu) > 0 && (
                <div className="flex justify-between text-caption font-semibold">
                    <span className="uppercase tracking-tighter">{t('ticket.change_returned')}</span>
                    <span className="font-mono">{formatM(ticket.rendu || 0)}</span>
                </div>
            )}
          </div>
        )}
      </div>

      {/* TAXES */}
      {totalTVA > 0 && (
        <div className="mt-3 border-t border-black/20 pt-2 text-center font-mono text-[8px] italic">
          {t('ticket.base_ht')}: {formatM(totalHT)} | {t('ticket.tva')}: {formatM(totalTVA)}
        </div>
      )}

      {/* FOOTER */}
      <div className="mt-4 text-center">
        <div className="mb-3 border-t border-black/20 pt-3">
            <p className="text-caption font-medium whitespace-pre-line">{settings.ticket_footer_message || t('ticket.visit_thanks')}</p>
        </div>
        
        {showBarcode && (
            <div className="inline-block px-2 bg-base-100 text-center">
                <Barcode 
                    value={barcodeValue} 
                    format="CODE128"
                    height={50} 
                    width={1.8} 
                    fontSize={10} 
                    displayValue={false}
                    margin={15}
                    background="#ffffff"
                />
                <div className="mt-1 font-mono text-caption font-medium">{barcodeValue}</div>
            </div>
        )}

        <div className="mt-5 border-t border-black/15 pt-2 text-[7px] font-medium uppercase tracking-[0.2em]">
          ZENITH POS SYSTEM
        </div>
      </div>

    </div>
  );
};
