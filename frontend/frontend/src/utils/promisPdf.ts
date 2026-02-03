import jsPDF from 'jspdf';
import { format } from 'date-fns';
import type { PharmacySettings } from '../hooks/usePharmacySettings';
import type { ProduitModel } from '../types';

// Interface for the data needed to generate the ticket
export interface PromisItem {
    id: number;
    produit_nom: string; // Or get from product object
    promisQuantity: number;
    // We might have the full product object or just name
    produit?: ProduitModel;
    date_promis: string; // ISO date
    status: string;
}

export interface PromisTicketData {
    client_name: string;
    client_phone?: string;
    items: PromisItem[];
    pharmacy: PharmacySettings;
    facture_id?: number | string;
    is_paid: boolean; // Derived from invoice status or assumption
}

export const generatePromisTicket = (data: PromisTicketData) => {
    // 80mm width, dynamic height (start with something tall, jspdf can handle it or we calculate)
    // For thermal printers, width is key. 80mm = ~226 pts
    const width = 80;
    // Calculate estimated height needed
    const estimatedHeight = 200 + (data.items.length * 10 * 2) + 50; // Base + items * 2 copies + padding

    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: [width, estimatedHeight]
    });

    const centerX = width / 2;
    let currentY = 5;

    // Helper to draw a dashed line
    const drawDashedLine = (y: number) => {
        doc.setLineWidth(0.5);
        doc.setLineDashPattern([3, 3], 0);
        doc.line(5, y, width - 5, y);
        doc.setLineDashPattern([], 0); // Reset
    };

    // Helper to draw one copy of the ticket
    const drawTicketCopy = (title: string) => {
        // --- Header ---
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(data.pharmacy.pharmacy_name.toUpperCase(), centerX, currentY, { align: 'center' });
        currentY += 5;

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        if (data.pharmacy.phone) {
            doc.text(`Tél: ${data.pharmacy.phone}`, centerX, currentY, { align: 'center' });
            currentY += 4;
        }
        if (data.pharmacy.city) {
            doc.text(data.pharmacy.city, centerX, currentY, { align: 'center' });
            currentY += 6;
        }

        // Title
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text("TICKET PROMIS", centerX, currentY, { align: 'center' });
        currentY += 5;
        doc.setFontSize(8);
        doc.text(`(${title})`, centerX, currentY, { align: 'center' });
        currentY += 6;

        drawDashedLine(currentY);
        currentY += 5;

        // --- Client Info ---
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text("CLIENT:", 5, currentY);
        doc.setFont('helvetica', 'normal');
        doc.text(data.client_name, 25, currentY);
        currentY += 5;
        if (data.client_phone) {
            doc.text(`Tél: ${data.client_phone}`, 25, currentY);
            currentY += 5;
        }

        doc.text(`Date: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 5, currentY);
        currentY += 5;
        if (data.facture_id) {
            doc.text(`Réf Transaction: #${data.facture_id}`, 5, currentY);
            currentY += 5;
        }

        drawDashedLine(currentY);
        currentY += 5;

        // --- Items ---
        doc.setFont('helvetica', 'bold');
        doc.text("Produit", 5, currentY);
        doc.text("Qté", width - 15, currentY, { align: 'right' });
        currentY += 5;

        doc.setFont('helvetica', 'normal');
        doc.setFont('helvetica', 'normal');
        data.items.forEach(item => {
            // Text wrapping for product name
            const maxNameWidth = 55; // Leave space for Qty
            const splitName = doc.splitTextToSize(item.produit_nom, maxNameWidth);
            const lineCount = splitName.length;

            // Name
            doc.text(splitName, 5, currentY);

            // Quantity (aligned with first line of name)
            doc.setFontSize(10); // Bigger Qty
            doc.setFont('helvetica', 'bold');
            doc.text(item.promisQuantity.toString(), width - 10, currentY, { align: 'right' });
            doc.setFontSize(9); // Reset
            doc.setFont('helvetica', 'normal');

            // Barcode (below name)
            let barcodeHeight = 0;
            if (item.produit?.cip1 || item.produit?.cip2) {
                const code = item.produit.cip1 || item.produit.cip2;
                doc.setFontSize(7);
                // Print barcode below the last line of the name
                doc.text(`Code: ${code}`, 5, currentY + (lineCount * 4));
                doc.setFontSize(9);
                barcodeHeight = 4;
            }

            currentY += (lineCount * 4) + barcodeHeight + 2; // Total height used
        });

        currentY += 2;
        drawDashedLine(currentY);
        currentY += 5;

        // --- Payment Status ---
        doc.setFont('helvetica', 'bold');
        const statusText = data.is_paid ? "STATUT: PAYÉ" : "STATUT: À RÉGLER";
        doc.text(statusText, centerX, currentY, { align: 'center' });
        currentY += 6;

        // Footer Message
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7);
        doc.text("A conserver pour le retrait", centerX, currentY, { align: 'center' });
        currentY += 4;

        // Ticket IDs (range)
        if (data.items.length > 0) {
            const ids = data.items.map(i => i.id).join(', ');
            doc.text(`N° Promis: ${ids}`, centerX, currentY, { align: 'center' });
            currentY += 5;
        }
    };

    // 1. Pharmacy Copy
    drawTicketCopy("EXEMPLAIRE PHARMACIE");

    currentY += 5;

    // Cut Line
    doc.setFontSize(8);
    doc.text("- - - - - - - - Découper ici - - - - - - - -", centerX, currentY, { align: 'center' });
    currentY += 8;

    // 2. Client Copy
    drawTicketCopy("EXEMPLAIRE CLIENT");

    // Output
    doc.save(`ticket_promis_${format(new Date(), 'yyyyMMddHHmm')}.pdf`);
};
