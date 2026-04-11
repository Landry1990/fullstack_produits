
import { forwardRef } from 'react';
import Barcode from 'react-barcode';
import type { TicketCaisse, PharmacySettings } from '../../types';
import { formatNumber } from '../../utils/formatters';

interface TicketTemplateProps {
  ticket: TicketCaisse;
  settings: PharmacySettings;
}

export const TicketTemplate = forwardRef<HTMLDivElement, TicketTemplateProps>(({ ticket, settings }, ref) => {
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
        'coupon': 'Coupon de Monnaie',
        'depot': 'Dépôt Client'
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
      className="p-1 bg-white text-black font-sans text-[10px] leading-tight print:p-0" 
      style={{ 
        width: `${ticketWidth}mm`, 
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
        <h2 className="text-sm font-black uppercase mb-1 leading-none tracking-tight">
            {settings.pharmacy_name || 'PHARMACIE'}
        </h2>
        <div className="border-b-2 border-black w-3/4 mx-auto mb-2"></div>
        <div className="text-[9px] leading-tight">
            {settings.address && <p className="mb-1 font-bold">{settings.address}</p>}
            <div className="font-mono text-[8px]">
               {settings.phone && <div>Tél: {settings.phone}</div>}
               {settings.niu && <div>NIU: {settings.niu}</div>}
               {settings.registre_commerce && <div>RC: {settings.registre_commerce}</div>}
            </div>
        </div>
      </div>

      {/* TICKET INFO */}
      <div className="border-y border-black border-dashed py-2 my-2 space-y-1">
          {ticket.is_duplicate && (
              <div className="text-center font-black text-xs uppercase mb-1 underline">
                  *** DUPLICATA ***
              </div>
          )}
          
          <table className="w-full text-[9px] font-mono">
            <tbody>
              <tr>
                <td className="font-bold uppercase">Ticket N°</td>
                <td className="text-right font-black">{facture?.numero_facture || `#${ticket.id}`}</td>
              </tr>
              <tr>
                <td>Date</td>
                <td className="text-right">{formatDate(ticket.date_paiement)}</td>
              </tr>
              <tr>
                <td className="pt-2 font-bold uppercase">Client</td>
                <td className="pt-2 text-right font-black uppercase text-[10px]">{clientName}</td>
              </tr>
              {ticket.client_solde_depot && Number(ticket.client_solde_depot) > 0 && (
                <tr className="border-t border-black border-dotted mt-1">
                  <td className="py-1 font-bold uppercase">Solde Dépôt</td>
                  <td className="py-1 text-right font-black text-[11px]">{formatM(ticket.client_solde_depot)}</td>
                </tr>
              )}
              {ticket.client_points_fidelite !== undefined && ticket.client_points_fidelite !== null && (
                <tr className={ticket.client_solde_depot && Number(ticket.client_solde_depot) > 0 ? "" : "border-t border-black border-dotted mt-1"}>
                  <td className="py-1 font-bold uppercase">Points Fidélité</td>
                  <td className="py-1 text-right font-black text-[11px]">{ticket.client_points_fidelite} pts</td>
                </tr>
              )}
              <tr>
                <td className="pt-1">Vendeur</td>
                <td className="pt-1 text-right uppercase">{facture?.created_by_name || 'N/A'}</td>
              </tr>
              <tr>
                <td className="">Caissier</td>
                <td className="text-right uppercase">{ticket.user_details?.username || 'ADMIN'}</td>
              </tr>
            </tbody>
          </table>
      </div>

      {/* ITEMS TABLE */}
      <div className="mb-2">
          <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr className="border-b border-black text-[9px] font-black uppercase">
                <th className="py-1 text-left" style={{ width: '55%' }}>Désignation</th>
                <th className="py-1 text-center" style={{ width: '15%' }}>Qté</th>
                <th className="py-1 text-right" style={{ width: '30%' }}>Total</th>
              </tr>
            </thead>
            <tbody className="text-[10px]">
              {produits.map((p: any, idx: number) => {
                const qty = Math.abs(p.quantity);
                const price = Number(p.selling_price || 0);
                const lineTotal = qty * price;
                
                return (
                  <tr key={idx} className="border-b border-black/10">
                    <td className="py-2 align-top leading-tight overflow-hidden">
                        <div className="font-bold uppercase" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{getProductName(p)}</div>
                        <div className="text-[8px] font-mono italic">
                            {qty} x {formatM(price)}
                        </div>
                    </td>
                    <td className="py-2 text-center align-top font-mono">{qty}</td>
                    <td className="py-2 text-right align-top font-mono font-black">{formatM(lineTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
      </div>

      {/* TOTALS */}
      <div className="mt-2 space-y-1">
        {remise > 0 && (
            <div className="flex justify-between text-[9px] font-bold">
                <span>SOUS-TOTAL</span>
                <span className="font-mono">{formatM(totalTTC + remise)}</span>
            </div>
        )}
        
        {remise > 0 && (
            <div className="flex justify-between text-[10px] font-black">
                <span>REMISE (-)</span>
                <span className="font-mono">-{formatM(remise)}</span>
            </div>
        )}

        <div className="flex justify-between items-center py-2 border-y-2 border-black font-black">
            <span className="text-xs uppercase tracking-tight">NET À PAYER (CFA)</span>
            <span className="text-xl font-mono tracking-tighter tabular-nums">
                {formatM(totalTTC)}
            </span>
        </div>

        {(ticket.total_lettres || facture?.total_lettres) && (
            <div className="text-[9px] font-bold italic py-2 text-center uppercase border-b border-black border-dashed">
                {ticket.total_lettres || facture?.total_lettres}
            </div>
        )}

        {/* PAYMENTS */}
        <div className="pt-2">
          <table className="w-full text-[9px]">
            <tbody>
              {ticket.paiements_details && ticket.paiements_details.length > 0 ? (
                  ticket.paiements_details.map((paiement, idx) => (
                      <tr key={idx}>
                          <td className="uppercase font-bold">[{getModeLabel((paiement as any).mode_paiement || paiement.mode)}]</td>
                          <td className="text-right font-mono font-black">{formatM(paiement.montant)}</td>
                      </tr>
                  ))
              ) : (
                  <tr>
                       <td className="uppercase font-bold">[{getModeLabel(ticket.mode_paiement)}]</td>
                       <td className="text-right font-mono font-black">{formatM(totalTTC)}</td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* CHANGE */}
        {(Number(ticket.montant_verse) > 0 || Number(ticket.rendu) > 0) && (
          <div className="mt-2 pt-2 border-t border-black border-dotted space-y-1">
            {Number(ticket.montant_verse) > 0 && (
                <div className="flex justify-between text-[9px]">
                    <span className="uppercase italic">Espèces reçues</span>
                    <span className="font-mono font-bold">{formatM(ticket.montant_verse || 0)}</span>
                </div>
            )}
            {Number(ticket.rendu) > 0 && (
                <div className="flex justify-between text-xs font-black">
                    <span className="uppercase tracking-tighter">MONNAIE RENDUE</span>
                    <span className="font-mono">{formatM(ticket.rendu || 0)}</span>
                </div>
            )}
          </div>
        )}
      </div>

      {/* TAXES */}
      {totalTVA > 0 && (
        <div className="mt-4 text-[8px] text-center font-mono italic border-t border-black border-dotted pt-2">
          BASE HT: {formatM(totalHT)} | TVA: {formatM(totalTVA)}
        </div>
      )}

      {/* FOOTER */}
      <div className="text-center mt-6">
        <div className="mb-4 border-t border-black border-dashed pt-4">
            <p className="font-black text-[10px] uppercase mb-1">{settings.ticket_footer_message || 'Merci de votre visite'}</p>
            <p className="text-[9px] italic">À bientôt dans votre pharmacie !</p>
        </div>
        
        {facture?.numero_facture && (
             <div className="inline-block px-2 bg-white text-center">
                <Barcode 
                    value={facture.numero_facture} 
                    height={35} 
                    width={1.2} 
                    fontSize={10} 
                    displayValue={false}
                    margin={0}
                    background="#ffffff"
                />
                <div className="font-mono text-[10px] mt-1 font-black">{facture.numero_facture}</div>
            </div>
        )}

        <div className="mt-8 text-[7px] font-black tracking-[0.2em] uppercase border-t border-black pt-2">
          ZENITH POS SYSTEM
        </div>
      </div>

    </div>
  );
});

TicketTemplate.displayName = 'TicketTemplate';
