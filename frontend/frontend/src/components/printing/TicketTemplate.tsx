
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
      className="p-2 bg-white text-black font-sans text-[11px] leading-tight" 
      style={{ 
        width: `${ticketWidth}mm`, 
        maxWidth: `${ticketWidth}mm`,
        margin: '0 auto',
        minWidth: `${ticketWidth}mm`,
        letterSpacing: '-0.01em'
      }}
    >
      
      {/* HEADER */}
      <div className="text-center mb-4 border-b border-black pb-2">
        {settings.logo && (
          <img src={settings.logo} alt="Logo" className="h-10 mx-auto mb-2 grayscale object-contain" />
        )}
        <h2 className="text-base font-black uppercase mb-0.5 tracking-tight">{settings.pharmacy_name || 'PHARMACIE'}</h2>
        <div className="space-y-0 text-[10px] leading-snug">
            {settings.address && <p className="italic">{settings.address}</p>}
            <div className="flex justify-center gap-2 mt-1 font-bold">
               {settings.phone && <span>Tél: {settings.phone}</span>}
            </div>
            <div className="flex justify-center gap-2 opacity-70 text-[9px] uppercase mt-0.5">
               {settings.niu && <span>NIU: {settings.niu}</span>}
               {settings.registre_commerce && <span>RC: {settings.registre_commerce}</span>}
            </div>
        </div>
      </div>

      {/* TICKET INFO */}
      <div className="mb-3 space-y-0.5 text-[10px]">
        {ticket.is_duplicate && (
            <div className="text-center bg-black text-white font-black text-xs py-1 mb-2">
                *** DUPLICATA ***
            </div>
        )}
        <div className="flex justify-between border-b border-dotted border-black/20 pb-0.5">
            <span className="font-bold">Facture N°:</span>
            <span>{facture?.numero_facture || `#${ticket.id}`}</span>
        </div>
        {facture?.session_ticket_number && (
            <div className="flex justify-between bg-black/5 px-1 font-bold">
                <span>N° d'ordre:</span>
                <span className="text-sm">{facture.session_ticket_number}</span>
            </div>
        )}
        <div className="flex justify-between">
            <span className="font-bold">Date:</span>
            <span>{formatDate(ticket.date_paiement)}</span>
        </div>
        <div className="flex justify-between">
            <span className="font-bold">Client:</span>
            <span className="text-right truncate ml-2 font-medium">{clientName.toUpperCase()}</span>
        </div>
        <div className="flex justify-between opacity-80">
            <span>Caissier:</span>
            <span className="truncate ml-2">{ticket.user_details?.username || '---'}</span>
        </div>
      </div>

      {/* ITEMS TABLE HEADER */}
      <div className="flex justify-between border-y border-black py-1 font-black text-[9px] uppercase mb-1">
          <span className="flex-1">Désignation / Qté</span>
          <span className="w-16 text-right">Total</span>
      </div>

      {/* PRODUCTS */}
      <div className="mb-2 space-y-1.5">
        {produits.map((p: any, idx: number) => {
          const qty = Math.abs(p.quantity);
          const price = Number(p.selling_price || 0);
          const lineTotal = qty * price;
          
          return (
            <div key={idx} className="flex flex-col">
              <div className="flex justify-between items-start gap-1">
                <span className="flex-1 font-bold leading-none uppercase">
                    {getProductName(p)}
                </span>
                <span className="font-black whitespace-nowrap">
                    {formatM(lineTotal)}
                </span>
              </div>
              <div className="text-[9px] text-black/70 italic">
                {qty} x {formatM(price)}
              </div>
            </div>
          );
        })}
      </div>

      {/* TOTALS BOX */}
      <div className="border-t-2 border-dashed border-black mt-2 pt-2 pb-1 space-y-1">
        
        {remise > 0 && (
            <div className="flex justify-between text-[10px]">
                <span>Remise commerciale</span>
                <span className="font-bold">-{formatM(remise)}</span>
            </div>
        )}

        <div className="flex justify-between text-lg font-black leading-none py-1 border-y border-black mt-1">
            <span>TOTAL</span>
            <span>{formatM(totalTTC)} <span className="text-[10px] font-normal">F</span></span>
        </div>

        {/* PAYMENTS */}
        <div className="pt-1 text-[10px]">
          {ticket.paiements_details && ticket.paiements_details.length > 0 ? (
              ticket.paiements_details.map((paiement, idx) => (
                  <div key={idx} className="flex justify-between font-medium">
                      <span>{getModeLabel((paiement as any).mode_paiement || paiement.mode)}</span>
                      <span>{formatM(paiement.montant)}</span>
                  </div>
              ))
          ) : (
              <div className="flex justify-between">
                   <span>Mode: {getModeLabel(ticket.mode_paiement)}</span>
                   <span>{formatM(totalTTC)}</span>
              </div>
          )}
        </div>

        {/* CASH DETAILS */}
        {(Number(ticket.montant_verse) > 0 || Number(ticket.rendu) > 0) && (
          <div className="mt-1 pt-1 border-t border-dotted border-black/30 text-[9px] space-y-0.5">
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

      {/* TAX SUMMARY MINI */}
      {totalTVA > 0 && (
        <div className="mt-2 text-[8px] text-black/60 text-center leading-none">
          Dont TVA: {formatM(totalTVA)} F (HT: {formatM(totalHT)} F)
        </div>
      )}

      {/* FOOTER */}
      <div className="text-center mt-4 pt-2 border-t border-black pb-4">
        <p className="font-black text-[10px] uppercase">{settings.ticket_footer_message || 'Merci de votre visite'}</p>
        <p className="text-[9px] mt-0.5 opacity-80 italic italic">A bientôt !</p>
        
        {facture?.numero_facture && (
             <div className="flex flex-col items-center mt-3 opacity-90">
                <Barcode 
                    value={facture.numero_facture} 
                    height={25} 
                    width={1.2} 
                    fontSize={8} 
                    displayValue={true}
                    margin={0}
                    background="#ffffff"
                />
            </div>
        )}
        <div className="text-[7px] mt-2 text-black/30 font-bold tracking-widest uppercase">
          Logiciel de Gestion Antigravity
        </div>
      </div>

    </div>
  );
});

TicketTemplate.displayName = 'TicketTemplate';
