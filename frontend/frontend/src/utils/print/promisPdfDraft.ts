import jsPDF from 'jspdf';
import i18next from 'i18next';
import { formatDateTime, getLocalDateString } from '../dateUtils';
import { getDocumentLanguage, getDocumentLocale } from '../documentLang';
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
    const docT = i18next.getFixedT(getDocumentLanguage(), 'printing');
    const docLocale = getDocumentLocale();

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
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(data.pharmacy.pharmacy_name.toUpperCase(), centerX, currentY, { align: 'center' });
        currentY += 4;

        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        if (data.pharmacy.phone) {
            doc.text(`${docT('reglement.phone_short')}${data.pharmacy.phone}`, centerX, currentY, { align: 'center' });
            currentY += 3;
        }
        if (data.pharmacy.city) {
            doc.text(data.pharmacy.city, centerX, currentY, { align: 'center' });
            currentY += 4;
        }

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(docT('promis.ticket_title'), centerX, currentY, { align: 'center' });
        currentY += 4;
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(`(${title})`, centerX, currentY, { align: 'center' });
        currentY += 5;

        drawDashedLine(currentY);
        currentY += 4;

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(docT('promis.client_label'), 5, currentY);
        doc.setFont('helvetica', 'normal');
        doc.text(data.client_name, 20, currentY);
        currentY += 4;
        if (data.client_phone) {
            doc.text(`${docT('reglement.phone_short')}${data.client_phone}`, 20, currentY);
            currentY += 4;
        }

        doc.text(`${docT('reglement.date')} ${formatDateTime(new Date(), docLocale)}`, 5, currentY);
        currentY += 4;
        if (data.facture_id) {
            doc.text(docT('promis.ref_transaction', { id: data.facture_id }), 5, currentY);
            currentY += 4;
        }

        drawDashedLine(currentY);
        currentY += 4;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(docT('promis.col_product'), 5, currentY);
        doc.text(docT('promis.col_qty'), width - 12, currentY, { align: 'right' });
        currentY += 4;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        data.items.forEach(item => {
            const maxNameWidth = 52;
            const splitName = doc.splitTextToSize(item.produit_nom, maxNameWidth);
            const lineCount = splitName.length;

            doc.text(splitName, 5, currentY);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.text(item.promisQuantity.toString(), width - 7, currentY, { align: 'right' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);

            let barcodeHeight = 0;
            if (item.produit?.cip1 || item.produit?.cip2) {
                const code = item.produit.cip1 || item.produit.cip2;
                doc.setFontSize(6);
                doc.text(docT('promis.code', { code }), 5, currentY + (lineCount * 3));
                doc.setFontSize(7.5);
                barcodeHeight = 3;
            }

            currentY += (lineCount * 3) + barcodeHeight + 2;
        });

        currentY += 2;
        drawDashedLine(currentY);
        currentY += 4;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        const statusText = data.is_paid ? docT('promis.status_paid') : docT('promis.status_to_pay');
        doc.text(statusText, centerX, currentY, { align: 'center' });
        currentY += 5;

        doc.setFont('helvetica', 'italic');
        doc.setFontSize(6);
        doc.setTextColor(80, 80, 80);
        doc.text(docT('promis.keep_for_pickup'), centerX, currentY, { align: 'center' });
        currentY += 4;

        if (data.items.length > 0) {
            const ids = data.items.map(i => i.id).join(', ');
            doc.text(docT('promis.promis_no', { ids }), centerX, currentY, { align: 'center' });
            currentY += 4;
        }
    };

    drawTicketCopy(docT('promis.store_copy'));
    currentY += 4;

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(docT('promis.cut_here'), centerX, currentY, { align: 'center' });
    currentY += 6;

    drawTicketCopy(docT('promis.customer_copy'));

    const now = new Date();
    const ts = getLocalDateString(now).replace(/-/g, '') + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
    doc.save(`ticket_promis_${ts}.pdf`);
};
