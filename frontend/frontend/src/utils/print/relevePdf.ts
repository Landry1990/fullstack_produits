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

export function generateRelevePdf(data: RelevePdfData): jsPDF {
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

    // ── Ligne de séparation header ──────────────────────────────────────────
    const drawHeaderLine = () => {
        doc.setDrawColor(20, 20, 20);
        doc.setLineWidth(0.8);
        doc.line(margin, 48, pageWidth - margin, 48);
    };

    // ── HEADER ───────────────────────────────────────────────────────────────
    // Colonne gauche : pharmacie
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(20, 20, 20);
    doc.text((data.settings.pharmacy_name || 'PHARMACIE').toUpperCase(), margin, 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(90, 90, 90);
    let hy = 24;
    if (data.settings.address) {
        const lines = doc.splitTextToSize(data.settings.address, 85);
        doc.text(lines, margin, hy);
        hy += lines.length * 4;
    }
    if (data.settings.phone) { doc.text(`Tél : ${data.settings.phone}`, margin, hy); hy += 4; }
    if (data.settings.niu) { doc.text(`NIU : ${data.settings.niu}`, margin, hy); hy += 4; }
    if (data.settings.registre_commerce) { doc.text(`RCCM : ${data.settings.registre_commerce}`, margin, hy); }

    // Colonne droite : titre document
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(20, 20, 20);
    doc.text('RELEVÉ DE FACTURES', pageWidth - margin, 18, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.text(`Réf : ${ref}`, pageWidth - margin, 25, { align: 'right' });
    doc.text(`Édité le ${today}`, pageWidth - margin, 30, { align: 'right' });

    drawHeaderLine();

    // ── BLOC CLIENT + PÉRIODE ─────────────────────────────────────────────────
    const blockY = 53;
    const blockH = 30;
    const colW = (pageWidth - 2 * margin - 6) / 2;

    // Encadré Client
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, blockY, colW, blockH, 2, 2, 'S');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(140, 140, 140);
    doc.text('CLIENT', margin + 4, blockY + 5);
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(margin + 4, blockY + 6.5, margin + colW - 4, blockY + 6.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    const clientLines = doc.splitTextToSize(data.client.name.toUpperCase(), colW - 8);
    doc.text(clientLines, margin + 4, blockY + 12);
    let cy = blockY + 12 + clientLines.length * 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    if (data.client.address) { doc.text(data.client.address, margin + 4, cy); cy += 4; }
    if (data.client.phone) { doc.text(`Tél : ${data.client.phone}`, margin + 4, cy); cy += 4; }
    if (data.client.niu) { doc.text(`NIU : ${data.client.niu}`, margin + 4, cy); cy += 4; }
    if (data.client.registre_commerce) { doc.text(`RC : ${data.client.registre_commerce}`, margin + 4, cy); }

    // Encadré Période
    const col2X = margin + colW + 6;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.roundedRect(col2X, blockY, colW, blockH, 2, 2, 'S');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(140, 140, 140);
    doc.text('PÉRIODE COUVERTE', col2X + 4, blockY + 5);
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(col2X + 4, blockY + 6.5, col2X + colW - 4, blockY + 6.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text('Du :', col2X + 4, blockY + 14);
    doc.setFont('helvetica', 'bold');
    doc.text(fmtDate(data.periode.date_debut), col2X + colW - 4, blockY + 14, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text('Au :', col2X + 4, blockY + 21);
    doc.setFont('helvetica', 'bold');
    doc.text(fmtDate(data.periode.date_fin), col2X + colW - 4, blockY + 21, { align: 'right' });

    // ── TABLEAU DES CRÉANCES ──────────────────────────────────────────────────
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
        head: [['Date', 'N° Facture', 'Bénéficiaire / Ayant droit', 'Total TTC', 'Réglé', 'Reste']],
        body: rows,
        theme: 'striped',
        headStyles: {
            fillColor: [20, 20, 20],
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 8,
            cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
        },
        bodyStyles: {
            fontSize: 8.5,
            textColor: [40, 40, 40],
            cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
        },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        columnStyles: {
            0: { cellWidth: 22 },
            1: { cellWidth: 28, fontStyle: 'bold' },
            2: { cellWidth: 'auto' },
            3: { cellWidth: 28, halign: 'right' },
            4: { cellWidth: 25, halign: 'right', textColor: [5, 150, 105] },
            5: { cellWidth: 25, halign: 'right', textColor: [220, 38, 38], fontStyle: 'bold' },
        },
        margin: { left: margin, right: margin },
        didDrawPage: (hookData) => {
            // Numéro de page
            doc.setFontSize(7);
            doc.setTextColor(160, 160, 160);
            doc.text(
                `Page ${hookData.pageNumber}`,
                pageWidth - margin,
                pageHeight - 8,
                { align: 'right' }
            );
        },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 8;

    // ── TOTAUX ────────────────────────────────────────────────────────────────
    const totW = 80;
    const totX = pageWidth - margin - totW;

    doc.setDrawColor(20, 20, 20);
    doc.setLineWidth(0.6);
    doc.line(totX, finalY, pageWidth - margin, finalY);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);

    // Total facturé
    doc.text('Total Facturé :', totX, finalY + 7);
    doc.setFont('helvetica', 'bold');
    doc.text(`${fmt(data.totaux.total_factures)} F`, pageWidth - margin, finalY + 7, { align: 'right' });

    // Total réglé (vert)
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(5, 150, 105);
    doc.text('Total Réglé :', totX, finalY + 14);
    doc.setFont('helvetica', 'bold');
    doc.text(`${fmt(data.totaux.total_paye)} F`, pageWidth - margin, finalY + 14, { align: 'right' });

    // Séparateur
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(totX, finalY + 17, pageWidth - margin, finalY + 17);

    // NET À PAYER (rouge, encadré)
    const netBoxY = finalY + 19;
    doc.setFillColor(255, 245, 245);
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.4);
    doc.roundedRect(totX, netBoxY, totW, 12, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(220, 38, 38);
    doc.text('NET À PAYER :', totX + 3, netBoxY + 7.5);
    doc.setFontSize(11);
    doc.text(`${fmt(data.totaux.total_reste)} F`, pageWidth - margin - 3, netBoxY + 7.5, { align: 'right' });

    // ── SIGNATURES ────────────────────────────────────────────────────────────
    const sigY = Math.min(netBoxY + 25, pageHeight - 40);
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(margin, sigY, pageWidth - margin, sigY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text('SIGNATURE CLIENT', margin + 25, sigY + 5, { align: 'center' });
    doc.text('LA DIRECTION', pageWidth - margin - 25, sigY + 5, { align: 'center' });

    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.line(margin + 5, sigY + 20, margin + 50, sigY + 20);
    doc.line(pageWidth - margin - 50, sigY + 20, pageWidth - margin - 5, sigY + 20);

    // ── PIED DE PAGE ─────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.text(
        `${data.settings.pharmacy_name || 'PHARMACIE'} · Document généré le ${today}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: 'center' }
    );

    return doc;
}
