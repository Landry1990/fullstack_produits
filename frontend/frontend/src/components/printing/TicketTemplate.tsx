
import { forwardRef } from 'react';
import Barcode from 'react-barcode';
import type { TicketCaisse, PharmacySettings } from '../../types';
import { formatNumber } from '../../utils/formatters';

interface TicketTemplateProps {
  ticket: TicketCaisse;
  settings: PharmacySettings;
}

export const TicketTemplate = forwardRef<HTMLDivElement, TicketTemplateProps>(({ ticket, settings }, ref) => {
  // Safe helper for product name
  const getProductName = (p: any) => {
    if (!p) return 'Article inconnu';
    if (typeof p.produit === 'object') return p.produit.name;
    return p.produit_nom || `Produit #${p.produit || '?'}`;
  };

  const formatDate = (dateStr: string) => {
    try {
        return new Date(dateStr).toLocaleString('fr-FR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch (e) {
        return dateStr;
    }
  };

  const formatM = (val: number | string) => {
    return formatNumber(Math.round(Number(val)));
  };

  const getModeLabel = (mode: string) => {
      const labels: { [key: string]: string } = {
        'especes': 'Espèces',
        'carte': 'Carte',
        'cheque': 'Chèque',
        'virement': 'Virement',
        'om': 'Orange Money',
        'momo': 'Mobile Money',
        'en_compte': 'En compte',
        'coupon': 'Coupon de Monnaie'
      };
      return labels[mode] || mode?.toUpperCase() || 'N/A';
  };

  const facture = typeof ticket.facture === 'object' ? ticket.facture : null;
  const produits = facture?.produits || [];
  const totalTTC = Number(ticket.montant || facture?.total_ttc || 0);
  const totalTVA = facture ? Number(facture.total_tva || 0) : 0;
  const totalHT = totalTTC - totalTVA;
  const remise = facture ? Number(facture.remise) : 0;
  const ticketWidth = settings.ticket_paper_width || 80;
  
  const clientName = ticket.client_name 
      || facture?.client_name_override 
      || facture?.client_name 
      || (facture?.client && typeof facture.client === 'object' && 'name' in facture.client ? (facture.client as any).name : null)
      || 'Client de passage';

  return (
    <div 
      ref={ref} 
      data-theme="light"
      className="p-1 bg-base-100 text-base-content font-sans text-[10px] leading-tight" 
      style={{ 
        width: `${ticketWidth}mm`, 
        maxWidth: `${ticketWidth}mm`,
        margin: '0 auto',
        minWidth: `${ticketWidth}mm`,
        letterSpacing: '-0.01em',
      }}
    >
      
      {/* HEADER - Compact */}
      <div className="text-center mb-2 border-b-2 border-black pb-2">
        {settings.logo && (
          <img src={settings.logo} alt="Logo" className="h-10 mx-auto mb-2 grayscale object-contain" />
        )}
        <h2 className="text-sm font-black uppercase mb-1 leading-none">{settings.pharmacy_name || 'PHARMACIE'}</h2>
        <div className="text-[10px] leading-tight space-y-0.5">
            {settings.address && <p>{settings.address}</p>}
            <div className="font-bold flex flex-wrap justify-center gap-x-2">
               {settings.phone && <span className="whitespace-nowrap">Tél: {settings.phone}</span>}
               {settings.niu && <span className="whitespace-nowrap">NIU: {settings.niu}</span>}
               {settings.registre_commerce && <span className="whitespace-nowrap">RC: {settings.registre_commerce}</span>}
            </div>
        </div>
      </div>

      {/* TICKET INFO - Table layout for robustness */}
      <table className="w-full mb-2 text-[10px] border-collapse">
        <tbody>
            {ticket.is_duplicate && (
                <tr>
                    <td colSpan={2} className="text-center bg-black text-white font-black py-1">*** DUPLICATA ***</td>
                </tr>
            )}
            <tr className="border-b border-dotted border-black/20">
                <td className="font-bold py-0.5">Facture N°:</td>
                <td className="text-right py-0.5">{facture?.numero_facture || `#${ticket.id}`}</td>
            </tr>
            {facture?.session_ticket_number && (
                <tr className="bg-black/5">
                    <td className="font-bold py-0.5 px-1">N° d'ordre:</td>
                    <td className="text-right py-0.5 px-1 font-black text-sm">{facture.session_ticket_number}</td>
                </tr>
            )}
            <tr>
                <td className="font-bold py-0.5">Date:</td>
                <td className="text-right py-0.5 whitespace-nowrap">{formatDate(ticket.date_paiement)}</td>
            </tr>
            <tr>
                <td className="font-bold py-0.5">Client:</td>
                <td className="text-right py-0.5 font-bold uppercase">{clientName}</td>
            </tr>
            <tr className="opacity-70">
                <td className="py-0.5">Caissier:</td>
                <td className="text-right py-0.5">{ticket.user_details?.username || '---'}</td>
            </tr>
        </tbody>
      </table>

      {/* ITEMS TABLE */}
      <table className="w-full mb-2 text-[10px] border-collapse">
        <thead>
            <tr className="border-y border-black font-black uppercase text-[9px]">
                <th className="py-1 text-left">Désignation</th>
                <th className="py-1 text-center w-8">Qté</th>
                <th className="py-1 text-right w-20">Total</th>
            </tr>
        </thead>
        <tbody>
            {produits.map((p: any, idx: number) => {
              const qty = Math.abs(p.quantity);
              const price = Number(p.selling_price || 0);
              const lineTotal = qty * price;
              
              return (
                <tr key={idx} className="border-b border-black/5 align-top">
                  <td className="py-1.5 pr-1 uppercase font-bold leading-tight">
                    {getProductName(p)}
                  </td>
                  <td className="py-1.5 text-center">{qty}</td>
                  <td className="py-1.5 text-right font-black">{formatM(lineTotal)}</td>
                </tr>
              );
            })}
        </tbody>
      </table>

      {/* TOTALS & PAYMENTS */}
      <div className="border-t-2 border-black pt-1 space-y-1">
        {remise > 0 && (
            <div className="flex justify-between text-[10px]">
                <span>Remise commerciale</span>
                <span className="font-bold">-{formatM(remise)}</span>
            </div>
        )}

        <div className="flex justify-between items-baseline text-sm font-black py-1 border-y-2 border-black">
            <span className="uppercase mr-2">TOTAL NET</span>
            <span className="whitespace-nowrap">{formatM(totalTTC)} F</span>
        </div>

        {(ticket.total_lettres || facture?.total_lettres) && (
            <div className="text-[9px] font-bold italic py-1 border-b border-black/10 uppercase leading-snug">
                {ticket.total_lettres || facture?.total_lettres}
            </div>
        )}

        <div className="pt-1 text-[10px] space-y-0.5">
          {ticket.paiements_details && ticket.paiements_details.length > 0 ? (
              ticket.paiements_details.map((paiement, idx) => (
                  <div key={idx} className="flex justify-between">
                      <span className="mr-2 uppercase text-[9px]">{getModeLabel((paiement as any).mode_paiement || paiement.mode)}</span>
                      <span className="font-bold whitespace-nowrap">{formatM(paiement.montant)}</span>
                  </div>
              ))
          ) : (
              <div className="flex justify-between">
                   <span>Mode: {getModeLabel(ticket.mode_paiement)}</span>
                   <span className="font-bold">{formatM(totalTTC)}</span>
              </div>
          )}
        </div>

        {(Number(ticket.montant_verse) > 0 || Number(ticket.rendu) > 0) && (
          <div className="mt-1 pt-1 border-t border-dotted border-black/30 text-[9px] space-y-0.5 opacity-80">
            {Number(ticket.montant_verse) > 0 && (
                <div className="flex justify-between">
                    <span>Espèces reçues</span>
                    <span className="font-bold">{formatM(ticket.montant_verse || 0)}</span>
                </div>
            )}
            {Number(ticket.rendu) > 0 && (
                <div className="flex justify-between">
                    <span>Monnaie rendue</span>
                    <span className="font-bold">{formatM(ticket.rendu || 0)}</span>
                </div>
            )}
          </div>
        )}
      </div>

      {totalTVA > 0 && (
        <div className="mt-2 text-[8px] text-center opacity-60">
          Base HT: {formatM(totalHT)} | TVA: {formatM(totalTVA)}
        </div>
      )}

      {/* FOOTER */}
      <div className="text-center mt-4 border-t border-black pt-2 pb-2">
        <p className="font-black text-[10px] uppercase mb-1">{settings.ticket_footer_message || 'Merci de votre visite'}</p>
        <p className="text-[9px] mt-1 italic">Bienvenue chez nous !</p>
        
        {facture?.numero_facture && (
             <div className="flex flex-col items-center mt-3 scale-90">
                <Barcode 
                    value={facture.numero_facture} 
                    height={20} 
                    width={1} 
                    fontSize={8} 
                    displayValue={true}
                    margin={0}
                    background="#ffffff"
                />
            </div>
        )}
        <div className="text-[7px] mt-3 opacity-30 font-bold tracking-widest uppercase">
          Logiciel de Gestion ZENITH
        </div>
      </div>

    </div>
  );
});

TicketTemplate.displayName = 'TicketTemplate';
