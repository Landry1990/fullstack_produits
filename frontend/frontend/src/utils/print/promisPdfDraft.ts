import jsPDF from 'jspdf';
import { format } from 'date-fns';
import type { PharmacySettings } from '../../hooks/usePharmacySettings';
import type { ProduitModel } from '../../types';

export interface PromisItem {
    id: number;
    produit_nom: string;
    promisQuantity: number;
    produit?: ProduitModel;
    date_promis: string;
    status: string;
}

export interface PromisTicketData {
    client_name: string;
    client_phone?: string;
    items: PromisItem[];
    pharmacy: PharmacySettings;
    facture_id?: number | string;
    is_paid: boolean;
}

export const generatePromisTicketDraft = (data: PromisTicketData) => {
    const width = data.pharmacy.ticket_paper_width || 80;
    const estimatedHeight = 140 + (data.items.length * 10 * 2) + 40;

    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: [width, estimatedHeight]
    });

    const centerX = width / 2;
    let currentY = 5;

    const drawDashedLine = (y: number) => {
        doc.setLineWidth(0.3);
        doc.setLineDashPattern([2, 2], 0);
        doc.line(5, y, width - 5, y);
        doc.setLineDashPattern([], 0);
    };

    const drawTicketCopy = (title: string) => {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(data.pharmacy.pharmacy_name.toUpperCase(), centerX, currentY, { align: 'center' });
        currentY += 4;

        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        if (data.pharmacy.phone) {
            doc.text(`Tel: ${data.pharmacy.phone}`, centerX, currentY, { align: 'center' });
            currentY += 3;
        }
        if (data.pharmacy.city) {
            doc.text(data.pharmacy.city, centerX, currentY, { align: 'center' });
            currentY += 4;
        }

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('TICKET PROMIS', centerX, currentY, { align: 'center' });
        currentY += 4;
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(`(${title})`, centerX, currentY, { align: 'center' });
        currentY += 5;

        drawDashedLine(currentY);
        currentY += 4;

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('CLIENT:', 5, currentY);
        doc.setFont('helvetica', 'normal');
        doc.text(data.client_name, 20, currentY);
        currentY += 4;
        if (data.client_phone) {
            doc.text(`Tel: ${data.client_phone}`, 20, currentY);
            currentY += 4;
        }

        doc.text(`Date: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 5, currentY);
        currentY += 4;
        if (data.facture_id) {
            doc.text(`Ref Transaction: #${data.facture_id}`, 5, currentY);
            currentY += 4;
        }

        drawDashedLine(currentY);
        currentY += 4;

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Produit', 5, currentY);
        doc.text('Qte', width - 12, currentY, { align: 'right' });
        currentY += 4;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        data.items.forEach(item => {
            const maxNameWidth = 52;
            const splitName = doc.splitTextToSize(item.produit_nom, maxNameWidth);
            const lineCount = splitName.length;

            doc.text(splitName, 5, currentY);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.text(item.promisQuantity.toString(), width - 7, currentY, { align: 'right' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);

            let barcodeHeight = 0;
            if (item.produit?.cip1 || item.produit?.cip2) {
                const code = item.produit.cip1 || item.produit.cip2;
                doc.setFontSize(6);
                doc.text(`Code: ${code}`, 5, currentY + (lineCount * 3));
                doc.setFontSize(7.5);
                barcodeHeight = 3;
            }

            currentY += (lineCount * 3) + barcodeHeight + 2;
        });

        currentY += 2;
        drawDashedLine(currentY);
        currentY += 4;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        const statusText = data.is_paid ? 'STATUT: PAYE' : 'STATUT: A REGLER';
        doc.text(statusText, centerX, currentY, { align: 'center' });
        currentY += 5;

        doc.setFont('helvetica', 'italic');
        doc.setFontSize(6);
        doc.setTextColor(80, 80, 80);
        doc.text('A conserver pour le retrait', centerX, currentY, { align: 'center' });
        currentY += 4;

        if (data.items.length > 0) {
            const ids = data.items.map(i => i.id).join(', ');
            doc.text(`N Promis: ${ids}`, centerX, currentY, { align: 'center' });
            currentY += 4;
        }
    };

    drawTicketCopy('EXEMPLAIRE PHARMACIE');
    currentY += 4;

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text('- - - Decouper ici - - -', centerX, currentY, { align: 'center' });
    currentY += 6;

    drawTicketCopy('EXEMPLAIRE CLIENT');

    doc.save(`ticket_promis_${format(new Date(), 'yyyyMMddHHmm')}.pdf`);
};
