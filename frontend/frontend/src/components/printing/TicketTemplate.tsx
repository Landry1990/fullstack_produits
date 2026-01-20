
import React, { forwardRef } from 'react';
import Barcode from 'react-barcode';
import type { TicketCaisse, PharmacySettings } from '../../types';

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

  const getModeLabel = (mode: string) => {
      const labels: { [key: string]: string } = {
        'especes': 'Espèces',
        'carte': 'Carte',
        'cheque': 'Chèque',
        'virement': 'Virement',
        'om': 'Orange Money',
        'momo': 'Mobile Money',
        'en_compte': 'En compte'
      };
      return labels[mode] || mode?.toUpperCase() || 'N/A';
  };

  // Determine invoice data (handle both direct object and backend response structure)
  const facture = typeof ticket.facture === 'object' ? ticket.facture : null;
  const produits = facture?.produits || [];
  
  const totalHT = facture ? Number(facture.total_ht) : 0;
  const totalTVA = facture ? Number(facture.total_tva) : 0;
  const remise = facture ? Number(facture.remise) : 0;
  
  // Use ticket amount as final authority, fallback to facture total
  const totalTTC = Number(ticket.montant || facture?.total_ttc || 0);

  return (
    <div ref={ref} className="p-4 bg-white text-black font-mono text-xs leading-relaxed" style={{ width: '80mm', margin: '0 auto' }}>
      
      {/* HEADER */}
      <div className="text-center mb-4 border-b-2 border-black pb-3">
        <h2 className="text-lg font-black uppercase mb-1">{settings.pharmacy_name || 'PHARMACIE'}</h2>
        <div className="space-y-0.5 text-[11px]">
            {settings.address && <p>{settings.address}</p>}
            {settings.phone && <p>Tel: {settings.phone}</p>}
            {settings.email && <p>{settings.email}</p>}
            {settings.niu && <p>NIU: {settings.niu}</p>}
            {settings.registre_commerce && <p>RC: {settings.registre_commerce}</p>}
        </div>
      </div>

      {/* INFO */}
      <div className="mb-3 space-y-1 text-[11px]">
        <div className="flex justify-between">
            <span className="font-semibold">Ticket N°:</span>
            <span>#{ticket.id}</span>
        </div>
        {facture?.numero_facture && (
            <div className="flex justify-between">
                <span className="font-semibold">Facture:</span>
                <span>#{facture.numero_facture}</span>
            </div>
        )}
        <div className="flex justify-between">
            <span className="font-semibold">Date:</span>
            <span>{formatDate(ticket.date_paiement)}</span>
        </div>
        <div className="flex justify-between">
            <span className="font-semibold">Client:</span>
            <span className="text-right max-w-[50%] truncate">{ticket.client_name || 'Passage'}</span>
        </div>
        {ticket.user_details && (
             <div className="flex justify-between">
                <span className="font-semibold">Caissier:</span>
                <span>{ticket.user_details.username}</span>
            </div>
        )}
      </div>

      {/* PRODUCTS */}
      <div className="border-y border-dashed border-black py-2 mb-3">
        {produits.map((p: any, idx: number) => (
          <div key={idx} className="flex justify-between mb-1 items-start">
            <span className="flex-1 pr-2">
                {getProductName(p)}
                {Math.abs(p.quantity) !== 1 && ` x${Math.abs(p.quantity)}`}
            </span>
            <span className="whitespace-nowrap">
                {Math.round(Math.abs(p.quantity) * Number(p.selling_price || 0)).toLocaleString('fr-FR')}
            </span>
          </div>
        ))}
      </div>

      {/* TOTALS */}
      <div className="space-y-1 font-bold text-right text-[11px]">
        
        {/* Subtotals only if relevant */}
        {(totalTVA > 0 || remise > 0) && (
            <>
                <div className="flex justify-between font-normal text-[10px]">
                    <span>Sous-total HT</span>
                    <span>{Math.round(totalHT).toLocaleString('fr-FR')}</span>
                </div>
                {remise > 0 && (
                    <div className="flex justify-between font-normal text-[10px]">
                        <span>Remise</span>
                        <span>-{Math.round(remise).toLocaleString('fr-FR')}</span>
                    </div>
                )}
                 <div className="flex justify-between font-normal text-[10px]">
                    <span>TVA</span>
                    <span>{Math.round(totalTVA).toLocaleString('fr-FR')}</span>
                </div>
                <div className="my-1 border-t border-dotted border-black"></div>
            </>
        )}

        <div className="flex justify-between text-base border-y-2 border-black py-1 my-1">
            <span>TOTAL TTC</span>
            <span>{Math.round(totalTTC).toLocaleString('fr-FR')} F</span>
        </div>

        {/* PAYMENTS */}
        {ticket.paiements_details && ticket.paiements_details.length > 0 ? (
             <div className="mt-2 text-[10px] font-normal pt-1">
                {ticket.paiements_details.map((paiement, idx) => {
                    const isPartPatient = paiement.part_patient && paiement.part_patient > 0;
                    const isPartAssurance = paiement.part_assurance && paiement.part_assurance > 0;
                    return (
                        <div key={idx} className="flex justify-between">
                            <span>
                                {getModeLabel(paiement.mode || paiement.mode_paiement || '')}
                                {isPartPatient && ' (Patient)'}
                                {isPartAssurance && ' (Assur)'}
                            </span>
                            <span>{Math.round(paiement.montant).toLocaleString('fr-FR')}</span>
                        </div>
                    );
                })}
            </div>
        ) : (
            <div className="flex justify-between text-[10px] font-normal mt-1">
                 <span>Mode: {getModeLabel(ticket.mode_paiement)}</span>
                 <span>{Math.round(totalTTC).toLocaleString('fr-FR')}</span>
            </div>
        )}

        {/* MONNAIE */}
        {Number(ticket.montant_verse) > 0 && (
             <div className="flex justify-between text-[10px] font-normal border-t border-dotted border-black pt-1 mt-1">
                <span>Espèces Versées</span>
                <span>{Math.round(Number(ticket.montant_verse)).toLocaleString('fr-FR')}</span>
            </div>
        )}
        {Number(ticket.rendu) > 0 && (
             <div className="flex justify-between text-[10px] font-normal">
                <span>Rendu</span>
                <span>{Math.round(Number(ticket.rendu)).toLocaleString('fr-FR')}</span>
            </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="text-center mt-4 text-[10px] border-t border-black pt-2">
        <p className="font-semibold">{settings.ticket_footer_message || 'Merci de votre visite !'}</p>
        <p className="mt-0.5 pb-2">À bientôt.</p>
        
        {facture?.numero_facture && (
             <div className="flex justify-center mt-2">
                <Barcode 
                    value={facture.numero_facture} 
                    height={30} 
                    width={1} 
                    fontSize={10} 
                    displayValue={true} 
                />
            </div>
        )}
      </div>

    </div>
  );
});

TicketTemplate.displayName = 'TicketTemplate';
