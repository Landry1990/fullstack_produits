import { formatCurrency, formatNumber } from '../formatters';
import { formatDate as formatLocaleDate } from '../dateUtils';

// Interfaces based on InvoiceData and PharmacySettings
export interface ThermalTicketData {
    id: number;
    numero_facture: string;
    date: string;
    client?: { name?: string };
    client_name_override?: string;
    vendeur_nom?: string;
    mode_reglement?: string;
    total_ht: number;
    total_tva: number;
    total_ttc: number;
    remise: number;
    produits: Array<{
        produit_nom: string;
        quantity: number;
        selling_price: number;
        discount: number;
        tva: number;
    }>;
    tva_analysis?: Array<{
        taux: number;
        base_ht: number;
        montant_tva: number;
    }>;
}

export interface ThermalPharmacySettings {
    pharmacy_name: string;
    address: string;
    phone?: string;
    niu?: string;
    registre_commerce?: string;
    ticket_footer_message?: string;
}

/**
 * Génère le code HTML complet et ouvre la boîte de dialogue d'impression
 * formatée pour imprimante thermique (80mm).
 */
export const generateThermalTicket = (
    data: ThermalTicketData,
    settings: ThermalPharmacySettings,
    rendu: number = 0,
    montantVerse: number = 0
) => {
    // Calcul HT net réel de l'entête
    const totalLines = data.produits.length;
    let totalItems = 0;
    
    // Contruire les lignes produits HTML
    let produitsHtml = '';
    data.produits.forEach(item => {
        totalItems += item.quantity;
        const totalLigneTTC = (Number(item.selling_price) - Number(item.discount)) * item.quantity;

        produitsHtml += `
            <div class="product-line">
                <div class="product-name">${item.produit_nom}</div>
                <div class="product-details">
                    <span class="qty">${item.quantity} x ${formatNumber(Number(item.selling_price))}</span>
                    <span class="line-total">${formatNumber(totalLigneTTC)}</span>
                </div>
                ${item.discount > 0 ? `<div class="product-discount">Remise : -${formatNumber(item.discount)}</div>` : ''}
            </div>
        `;
    });



    const ticketHtml = `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>Ticket ${data.numero_facture || data.id}</title>
            <style>
                @media print {
                    @page { margin: 0; padding: 0; }
                    body { margin: 0; padding: 0; }
                }
                * {
                    box-sizing: border-box;
                    font-family: 'Courier New', Courier, monospace;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                    color-adjust: exact !important;
                }
                body {
                    width: 78mm;
                    margin: 0 auto;
                    padding: 4mm 2mm;
                    color: #000;
                    background: #fff;
                    font-size: 11px;
                    line-height: 1.2;
                }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .font-bold { font-weight: bold; }
                .text-lg { font-size: 14px; }
                .text-xl { font-size: 18px; line-height: 1; }
                .divider { border-top: 1px dashed #000; margin: 4px 0; }
                .divider-thick { border-top: 2px dashed #000; margin: 6px 0; }
                .flex-between { display: flex; justify-content: space-between; align-items: flex-start; }
                
                /* Header block */
                .header-block { margin-bottom: 6px; }
                .pharmacy-name { font-size: 16px; font-weight: 900; margin-bottom: 4px; text-transform: uppercase; }
                .header-meta { font-size: 10px; margin-bottom: 1px; }
                
                /* Meta info */
                .ticket-info { margin: 8px 0; font-size: 10px; }
                .ticket-info > div { margin-bottom: 2px; }
                
                /* Grid Products */
                .products-list { margin: 10px 0; }
                .product-line { margin-bottom: 6px; padding-bottom: 3px; border-bottom: 1px dotted #ccc; }
                .product-name { font-weight: 800; font-size: 11px; text-transform: uppercase; margin-bottom: 2px; }
                .product-details { display: flex; justify-content: space-between; padding-left: 5px; font-size: 12px; }
                .product-discount { text-align: right; color: #333; font-size: 9px; margin-top: 1px; font-style: italic; }
                
                /* Totals Block */
                .totals-block { margin-top: 10px; padding-top: 5px; }
                .totals-row { display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 11px; }
                .totals-row.main-total { font-weight: 900; font-size: 20px; text-transform: uppercase; margin: 8px 0; line-height: 1; }
                .totals-row.auth-code { font-size: 9px; margin-top: -6px; margin-bottom: 8px; }
                .payment-reglement { font-size: 12px; margin-top: 8px; font-weight: bold; padding: 4px 0; border-top: 1px dashed #000; border-bottom: 1px dashed #000; text-transform: uppercase; }
                
                /* Footer Block */
                .footer-block { margin-top: 15px; margin-bottom: 8px; font-size: 10px; text-align: center; }
                .footer-thanks { font-weight: bold; font-size: 11px; margin-bottom: 6px; }
                
            </style>
        </head>
        <body>
            <div class="text-center header-block">
                <div class="pharmacy-name">${settings.pharmacy_name || 'PHARMACIE'}</div>
                ${settings.address ? `<div class="header-meta">${settings.address}</div>` : ''}
                ${settings.phone ? `<div class="header-meta">Tél: ${settings.phone}</div>` : ''}
                ${settings.niu ? `<div class="header-meta">NIU: ${settings.niu}</div>` : ''}
                ${settings.registre_commerce ? `<div class="header-meta">RC: ${settings.registre_commerce}</div>` : ''}
            </div>
            
            <div class="ticket-info">
                <div class="flex-between">
                    <span>Ticket : <span class="font-bold">${data.numero_facture || data.id}</span></span>
                    <span>${formatLocaleDate(data.date)}</span>
                </div>
                <div class="flex-between">
                    <span>Client :</span>
                    <span class="font-bold">${data.client_name_override || data.client?.name || 'Client de passage'}</span>
                </div>
                <div class="flex-between">
                    <span>Caisse :</span>
                    <span>${data.vendeur_nom || 'N/A'}</span>
                </div>
            </div>
            
            <div class="divider-thick"></div>

            <div class="products-list">
                ${produitsHtml}
            </div>

            <div class="flex-between" style="font-size: 9px; margin-bottom: 5px;">
                <span>Articles : ${totalItems}</span>
                <span>Lignes : ${totalLines}</span>
            </div>

            <div class="divider"></div>

            <div class="totals-block">
                <div class="totals-row">
                    <span>TOTAL HT</span>
                    <span>${formatCurrency(data.total_ht)}</span>
                </div>
                ${data.total_tva > 0 ? `
                <div class="totals-row">
                    <span>TVA</span>
                    <span>${formatCurrency(data.total_tva)}</span>
                </div>` : ''}
                ${data.remise > 0 ? `
                <div class="totals-row font-bold" style="color:#555;">
                    <span>REMISE</span>
                    <span>-${formatCurrency(data.remise)}</span>
                </div>` : ''}
                
                <div class="divider"></div>
                
                <div class="totals-row main-total flex-between">
                    <span>TOTAL</span>
                    <span>${formatCurrency(data.total_ttc)}</span>
                </div>

                <div class="payment-reglement flex-between">
                    <span>REÇU (${data.mode_reglement || 'ESPÈCES'})</span>
                    <span>${formatCurrency(montantVerse || data.total_ttc)}</span>
                </div>
                
                ${rendu > 0 ? `
                <div class="totals-row font-bold" style="font-size: 13px; margin-top: 5px;">
                    <span>MONNAIE RENDUE</span>
                    <span>${formatCurrency(rendu)}</span>
                </div>
                ` : ''}
            </div>

            <div class="divider-thick" style="margin-top: 15px;"></div>
            
            <div class="footer-block">
                <div class="footer-thanks">${settings.ticket_footer_message || 'Merci de votre visite et prompt rétablissement.'}</div>
                <div style="font-size: 8px;">Logiciel de gestion ZENITH</div>
            </div>
            
            <script>
                // Auto-print upon loading
                window.onload = () => {
                    setTimeout(() => {
                        window.print();
                        // Optional: close the window after print dialog is closed
                        window.onafterprint = () => window.close();
                    }, 100);
                };
            </script>
        </body>
        </html>
    `;

    // Open a hidden/popup window
    const printWindow = window.open('', '_blank', 'width=350,height=600,top=100,left=100');
    if (printWindow) {
        printWindow.document.write(ticketHtml);
        printWindow.document.close();
    } else {
        console.warn('Le blocage des fenêtres contextuelles (popups) empêche l\'affichage du ticket.');
        alert('Veuillez autoriser les fenêtres contextuelles (popups) pour imprimer les tickets automatiquement.');
    }
};
