import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatNumber } from '../formatters';
import type { PharmacySettings } from '../../context/PharmacySettingsContext';

interface ReleveCreance {
    numero_facture: string;
    date: string;
    ayant_droit?: string | null;
    montant_total: number | string;
    montant_paye: number | string;
    reste_a_payer: number | string;
}

interface ReleveClient {
    id?: number;
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    niu?: string;
    registre_commerce?: string;
}

interface RelevePdfData {
    client: ReleveClient;
    creances: ReleveCreance[];
    totaux: {
        total_factures: number | string;
        total_paye: number | string;
        total_reste: number | string;
    };
    periode: {
        date_debut?: string | null;
        date_fin?: string | null;
    };
    settings: PharmacySettings;
}

export function generateRelevePdfDraft(data: RelevePdfData): jsPDF {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;

    const fmt = (val: number | string) =>
        formatNumber(Math.round(Number(val) || 0)).replace(/[\u00A0\u202F]/g, ' ');

    const fmtDate = (d?: string | null) => {
        if (!d) return "Aujourd'hui";
        return new Date(d).toLocaleDateString('fr-FR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
        });
    };

    const today = new Date().toLocaleDateString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
    });

    const refDate = new Date();
    const ref = `REL-${data.client.id ?? '0'}-${refDate.getFullYear()}${String(refDate.getMonth() + 1).padStart(2, '0')}${String(refDate.getDate()).padStart(2, '0')}`;

    // Header
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text((data.settings.pharmacy_name || 'PHARMACIE').toUpperCase(), margin, 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(80, 80, 80);
    let hy = 24;
    if (data.settings.address) {
        const lines = doc.splitTextToSize(data.settings.address, 85);
        doc.text(lines, margin, hy);
        hy += lines.length * 4;
    }
    if (data.settings.phone) { doc.text(`Tel : ${data.settings.phone}`, margin, hy); hy += 4; }
    if (data.settings.niu) { doc.text(`NIU : ${data.settings.niu}`, margin, hy); hy += 4; }
    if (data.settings.registre_commerce) { doc.text(`RCCM : ${data.settings.registre_commerce}`, margin, hy); }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(15);
    doc.setTextColor(0, 0, 0);
    doc.text('RELEVE DE FACTURES', pageWidth - margin, 18, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`Ref : ${ref}`, pageWidth - margin, 25, { align: 'right' });
    doc.text(`Edite le ${today}`, pageWidth - margin, 30, { align: 'right' });

    doc.setDrawColor(120, 120, 120);
    doc.setLineWidth(0.3);
    doc.line(margin, 38, pageWidth - margin, 38);

    // Client + Periode
    const blockY = 43;
    const blockH = 28;
    const colW = (pageWidth - 2 * margin - 6) / 2;

    doc.setDrawColor(120, 120, 120);
    doc.setLineWidth(0.2);
    doc.rect(margin, blockY, colW, blockH, 'S');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text('CLIENT', margin + 4, blockY + 5);
    doc.line(margin + 4, blockY + 6.5, margin + colW - 4, blockY + 6.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    const clientLines = doc.splitTextToSize(data.client.name.toUpperCase(), colW - 8);
    doc.text(clientLines, margin + 4, blockY + 12);
    let cy = blockY + 12 + clientLines.length * 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    if (data.client.address) { doc.text(data.client.address, margin + 4, cy); cy += 4; }
    if (data.client.phone) { doc.text(`Tel : ${data.client.phone}`, margin + 4, cy); cy += 4; }
    if (data.client.niu) { doc.text(`NIU : ${data.client.niu}`, margin + 4, cy); cy += 4; }
    if (data.client.registre_commerce) { doc.text(`RC : ${data.client.registre_commerce}`, margin + 4, cy); }

    const col2X = margin + colW + 6;
    doc.rect(col2X, blockY, colW, blockH, 'S');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text('PERIODE COUVERTE', col2X + 4, blockY + 5);
    doc.line(col2X + 4, blockY + 6.5, col2X + colW - 4, blockY + 6.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(`Du : ${fmtDate(data.periode.date_debut)}`, col2X + 4, blockY + 13);
    doc.text(`Au : ${fmtDate(data.periode.date_fin)}`, col2X + 4, blockY + 20);

    // Table
    const tableStartY = blockY + blockH + 8;

    const rows = data.creances.map(c => [
        fmtDate(c.date),
        c.numero_facture || '-',
        c.ayant_droit ? c.ayant_droit.toUpperCase() : '-',
        fmt(c.montant_total),
        fmt(c.montant_paye),
        fmt(c.reste_a_payer),
    ]);

    autoTable(doc, {
        startY: tableStartY,
        head: [['Date', 'N Facture', 'Beneficiaire', 'Total TTC', 'Regle', 'Reste']],
        body: rows,
        theme: 'plain',
        headStyles: {
            fillColor: [255, 255, 255],
            textColor: 0,
            fontStyle: 'normal',
            fontSize: 8,
            cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
        },
        bodyStyles: {
            fontSize: 8,
            textColor: [0, 0, 0],
            cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
        },
        alternateRowStyles: { fillColor: [255, 255, 255] },
        columnStyles: {
            0: { cellWidth: 22 },
            1: { cellWidth: 28 },
            2: { cellWidth: 'auto' },
            3: { cellWidth: 28, halign: 'right' },
            4: { cellWidth: 25, halign: 'right' },
            5: { cellWidth: 25, halign: 'right', fontStyle: 'normal' },
        },
        margin: { left: margin, right: margin },
        didDrawPage: (hookData) => {
            doc.setFontSize(7);
            doc.setTextColor(120, 120, 120);
            doc.text(
                `Page ${hookData.pageNumber}`,
                pageWidth - margin,
                pageHeight - 8,
                { align: 'right' }
            );
        },
    });

    const finalY = (doc as unknown).lastAutoTable.finalY + 8;

    // Totaux
    const totW = 80;
    const totX = pageWidth - margin - totW;

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(totX, finalY, pageWidth - margin, finalY);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    doc.text('Total Facture :', totX, finalY + 7);
    doc.setFont('helvetica', 'normal');
    doc.text(`${fmt(data.totaux.total_factures)} F`, pageWidth - margin, finalY + 7, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.text('Total Regle :', totX, finalY + 13);
    doc.setFont('helvetica', 'normal');
    doc.text(`${fmt(data.totaux.total_paye)} F`, pageWidth - margin, finalY + 13, { align: 'right' });

    doc.line(totX, finalY + 16, pageWidth - margin, finalY + 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('NET A PAYER :', totX, finalY + 22);
    doc.text(`${fmt(data.totaux.total_reste)} F`, pageWidth - margin, finalY + 22, { align: 'right' });

    // Signatures
    const sigY = Math.min(finalY + 32, pageHeight - 40);
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.2);
    doc.line(margin, sigY, pageWidth - margin, sigY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('SIGNATURE CLIENT', margin + 25, sigY + 5, { align: 'center' });
    doc.text('LA DIRECTION', pageWidth - margin - 25, sigY + 5, { align: 'center' });

    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.3);
    doc.line(margin + 5, sigY + 18, margin + 50, sigY + 18);
    doc.line(pageWidth - margin - 50, sigY + 18, pageWidth - margin - 5, sigY + 18);

    // Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(
        `${data.settings.pharmacy_name || 'PHARMACIE'} - Document genere le ${today}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: 'center' }
    );

    return doc;
}
