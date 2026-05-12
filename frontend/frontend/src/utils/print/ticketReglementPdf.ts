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

export function generateTicketReglementPdf(data: TicketReglementData): jsPDF {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;

    const fmt = (val: number | string | null | undefined) => {
        if (val == null || val === '') return '0';
        const num = Number(val);
        if (isNaN(num)) return '0';
        return formatNumber(Math.round(num)).replace(/[\u00A0\u202F]/g, ' ');
    };

    let y = 20;

    // ── HEADER ──
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(data.settings.pharmacy_name || 'PHARMACIE', pageWidth / 2, y, { align: 'center' });
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (data.settings.address) {
        doc.text(data.settings.address, pageWidth / 2, y, { align: 'center' });
        y += 5;
    }
    if (data.settings.phone) {
        doc.text(`Tel: ${data.settings.phone}`, pageWidth / 2, y, { align: 'center' });
        y += 5;
    }
    y += 8;

    // ── TITRE ──
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('TICKET DE RÈGLEMENT', pageWidth / 2, y, { align: 'center' });
    y += 10;

    // ── INFOS GÉNÉRALES ──
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const leftCol = margin;
    const rightCol = pageWidth - margin;

    doc.text(`Référence:`, leftCol, y);
    doc.setFont('helvetica', 'bold');
    doc.text(data.reference, leftCol + 25, y);
    doc.setFont('helvetica', 'normal');
    
    doc.text(`Date:`, rightCol - 40, y);
    doc.text(new Date(data.date).toLocaleDateString('fr-FR'), rightCol, y, { align: 'right' });
    y += 7;

    doc.text(`Client:`, leftCol, y);
    doc.setFont('helvetica', 'bold');
    doc.text(data.client_name, leftCol + 25, y);
    doc.setFont('helvetica', 'normal');
    y += 7;

    doc.text(`Mode:`, leftCol, y);
    doc.text(data.mode_paiement.toUpperCase(), leftCol + 25, y);
    y += 10;

    // ── LIGNE DE SÉPARATION ──
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // ── TABLEAU DES PAIEMENTS ──
    const tableData = data.paiements.map((p, index) => {
        // S'assurer que est_soldee est un boolean (le backend peut envoyer true, 'true', ou false)
        const isSoldee = p.est_soldee === true || String(p.est_soldee).toLowerCase() === 'true';
        const resteApres = Number(p.reste_apres) || 0;
        
        return [
            (index + 1).toString(),
            p.numero_facture || `-`,
            fmt(p.montant_total_facture),
            fmt(p.montant_paye),
            isSoldee ? 'SOLDÉE' : (resteApres > 0 ? `${fmt(resteApres)} reste` : '0'),
        ];
    });

    autoTable(doc, {
        startY: y,
        head: [['N°', 'Facture', 'Total Facture', 'Montant Réglé', 'Statut']],
        body: tableData,
        theme: 'grid',
        headStyles: {
            fillColor: [41, 98, 255],
            textColor: 255,
            fontSize: 9,
            fontStyle: 'bold',
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
        didParseCell: (hookData) => {
            // Colorer selon le statut
            if (hookData.section === 'body' && hookData.column.index === 4) {
                const cellText = String(hookData.cell.text[0] || '');
                if (cellText.includes('SOLDÉE')) {
                    hookData.cell.styles.textColor = [34, 197, 94]; // Vert
                    hookData.cell.styles.fontStyle = 'bold';
                } else if (cellText.includes('reste')) {
                    hookData.cell.styles.textColor = [245, 158, 11]; // Orange
                    hookData.cell.styles.fontStyle = 'bold';
                }
            }
        },
    });

    // @ts-ignore
    y = doc.lastAutoTable.finalY + 10;

    // ── RÉCAPITULATIF ──
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('RÉCAPITULATIF', margin, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    const recapWidth = 80;
    const recapX = pageWidth - margin - recapWidth;

    // Total dettes
    doc.text('Total des dettes:', recapX, y);
    doc.text(`${fmt(data.total_dettes)} F`, pageWidth - margin, y, { align: 'right' });
    y += 6;

    // Montant réglé (en vert/gras)
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(41, 98, 255);
    doc.text('Montant réglé:', recapX, y);
    doc.text(`${fmt(data.montant_regle)} F`, pageWidth - margin, y, { align: 'right' });
    y += 6;

    // Reste à payer (en rouge si > 0)
    const reste = Number(data.reste_a_payer);
    if (reste > 0) {
        doc.setTextColor(239, 68, 68);
    } else {
        doc.setTextColor(100, 100, 100);
    }
    doc.text('Reste à payer:', recapX, y);
    doc.text(`${fmt(data.reste_a_payer)} F`, pageWidth - margin, y, { align: 'right' });
    y += 10;

    // ── MESSAGE ÉTAT ──
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    if (reste > 0) {
        doc.text(`⚠ Il reste ${fmt(data.reste_a_payer)} F à régler`, margin, y);
    } else {
        doc.setTextColor(34, 197, 94);
        doc.text('✓ Toutes les factures sont soldées !', margin, y);
    }
    y += 15;

    // ── FOOTER ──
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(8);
    doc.text('Ce document est un justificatif de règlement.', pageWidth / 2, y, { align: 'center' });
    y += 5;
    doc.text(`Généré le ${new Date().toLocaleString('fr-FR')}`, pageWidth / 2, y, { align: 'center' });

    return doc;
}

