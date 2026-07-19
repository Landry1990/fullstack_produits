import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatNumber } from '../formatters';
import type { PharmacySettings } from '../../context/PharmacySettingsContext';

interface PaiementDetail {
    facture_id: number;
    numero_facture: string;
    montant_total_facture: number | string;
    montant_paye: number | string;
    reste_avant: number | string;
    reste_apres: number | string;
    est_soldee: boolean;
}

interface TicketReglementData {
    reference: string;
    date: string;
    client_name: string;
    mode_paiement: string;
    total_dettes: number | string;
    montant_regle: number | string;
    reste_a_payer: number | string;
    paiements: PaiementDetail[];
    settings: PharmacySettings;
}

export function generateTicketReglementPdfDraft(data: TicketReglementData): jsPDF {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;

    const fmt = (val: number | string | null | undefined) => {
        if (val == null || val === '') return '0';
        const num = Number(val);
        if (isNaN(num)) return '0';
        return formatNumber(Math.round(num)).replace(/[\u00A0\u202F]/g, ' ');
    };

    let y = 18;

    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(data.settings.pharmacy_name || 'PHARMACIE', pageWidth / 2, y, { align: 'center' });
    y += 7;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    if (data.settings.address) {
        doc.text(data.settings.address, pageWidth / 2, y, { align: 'center' });
        y += 5;
    }
    if (data.settings.phone) {
        doc.text(`Tel: ${data.settings.phone}`, pageWidth / 2, y, { align: 'center' });
        y += 5;
    }
    y += 6;

    // Title
    doc.setFontSize(13);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text('TICKET DE REGLEMENT', pageWidth / 2, y, { align: 'center' });
    y += 9;

    // Info
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    const leftCol = margin;
    const rightCol = pageWidth - margin;

    doc.text(`Reference:`, leftCol, y);
    doc.text(data.reference, leftCol + 25, y);
    doc.text(`Date:`, rightCol - 40, y);
    doc.text(new Date(data.date).toLocaleDateString('fr-FR'), rightCol, y, { align: 'right' });
    y += 6;

    doc.text(`Client:`, leftCol, y);
    doc.text(data.client_name, leftCol + 25, y);
    y += 6;

    doc.text(`Mode:`, leftCol, y);
    doc.text(data.mode_paiement.toUpperCase(), leftCol + 25, y);
    y += 8;

    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Table
    const tableData = data.paiements.map((p, index) => {
        const isSoldee = p.est_soldee === true || String(p.est_soldee).toLowerCase() === 'true';
        const resteApres = Number(p.reste_apres) || 0;

        return [
            (index + 1).toString(),
            p.numero_facture || `-`,
            fmt(p.montant_total_facture),
            fmt(p.montant_paye),
            isSoldee ? 'SOLDEE' : (resteApres > 0 ? `${fmt(resteApres)} reste` : '0'),
        ];
    });

    autoTable(doc, {
        startY: y,
        head: [['N', 'Facture', 'Total Facture', 'Montant Regle', 'Statut']],
        body: tableData,
        theme: 'plain',
        headStyles: {
            fillColor: [255, 255, 255],
            textColor: 0,
            fontSize: 9,
            fontStyle: 'normal',
        },
        bodyStyles: {
            fontSize: 9,
            fontStyle: 'normal',
        },
        columnStyles: {
            0: { cellWidth: 8, halign: 'center' },
            1: { cellWidth: 42, halign: 'left' },
            2: { cellWidth: 28, halign: 'right' },
            3: { cellWidth: 28, halign: 'right' },
            4: { cellWidth: 34, halign: 'center' },
        },
        margin: { left: margin, right: margin },
    });

    y = (doc as any).lastAutoTable.finalY + 8;

    // Recap
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text('RECAPITULATIF', margin, y);
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);

    const recapWidth = 80;
    const recapX = pageWidth - margin - recapWidth;

    doc.text('Total des dettes:', recapX, y);
    doc.text(`${fmt(data.total_dettes)} F`, pageWidth - margin, y, { align: 'right' });
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.text('Montant regle:', recapX, y);
    doc.text(`${fmt(data.montant_regle)} F`, pageWidth - margin, y, { align: 'right' });
    y += 5;

    const reste = Number(data.reste_a_payer);
    doc.setFont('helvetica', 'normal');
    doc.text('Reste a payer:', recapX, y);
    doc.text(`${fmt(data.reste_a_payer)} F`, pageWidth - margin, y, { align: 'right' });
    y += 10;

    // Message
    doc.setTextColor(80, 80, 80);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    if (reste > 0) {
        doc.text(`Il reste ${fmt(data.reste_a_payer)} F a regler`, margin, y);
    } else {
        doc.text('Toutes les factures sont soldees.', margin, y);
    }
    y += 12;

    // Footer
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(8);
    doc.text('Ce document est un justificatif de reglement.', pageWidth / 2, y, { align: 'center' });
    y += 5;
    doc.text(`Genere le ${new Date().toLocaleString('fr-FR')}`, pageWidth / 2, y, { align: 'center' });

    return doc;
}
