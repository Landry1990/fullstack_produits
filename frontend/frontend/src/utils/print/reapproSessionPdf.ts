import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { PharmacySettings } from '../../hooks/usePharmacySettings';

interface ReapproAdjustment {
  id: number;
  produit_name: string;
  lot_num: string | null;
  expiry: string | null;
  quantity_change: number;
}

interface ReapproSessionData {
  id: number;
  created_at: string;
  user_name: string;
  total_products: number;
  total_units: number;
  adjustments: ReapproAdjustment[];
}

const formatExpiry = (expiry: string | null | undefined) => {
  if (!expiry) return 'N/A';
  try {
    const date = new Date(expiry);
    return date.toLocaleDateString('fr-FR', { month: '2-digit', year: 'numeric' });
  } catch {
    return 'N/A';
  }
};

const formatDateTime = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
};

export function generateReapproSessionPdf(
  session: ReapproSessionData,
  settings: PharmacySettings
): jsPDF {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  const primaryColor = [16, 185, 129] as const; // emerald-500
  const darkText = [31, 41, 55] as const; // slate-800
  const mutedText = [107, 114, 128] as const; // slate-500

  let y = 20;

  // ── HEADER ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...primaryColor);
  doc.text('+', margin + 3, y - 6);

  doc.setFontSize(18);
  doc.setTextColor(...darkText);
  doc.text((settings.pharmacy_name || 'PHARMACIE').toUpperCase(), margin + 12, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...mutedText);
  if (settings.address) { doc.text(settings.address, margin, y); y += 4; }
  if (settings.phone) { doc.text(`Tél : ${settings.phone}`, margin, y); y += 4; }
  if (settings.niu) { doc.text(`NIU : ${settings.niu}`, margin, y); y += 4; }
  if (settings.registre_commerce) { doc.text(`RCCM : ${settings.registre_commerce}`, margin, y); y += 4; }

  // Title on the right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...darkText);
  doc.text('CONFIRMATION', pageWidth - margin, 20, { align: 'right' });
  doc.setFontSize(12);
  doc.setTextColor(...primaryColor);
  doc.text('DE RÉAPPROVISIONNEMENT', pageWidth - margin, 26, { align: 'right' });

  // Session number badge
  doc.setFillColor(16, 185, 129);
  doc.roundedRect(pageWidth - margin - 55, 32, 55, 10, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(`SESSION #${session.id}`, pageWidth - margin - 27.5, 38.5, { align: 'center' });

  // Separator line
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.5);
  y = Math.max(y, 45);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // ── INFO BOX ──
  const boxY = y;
  const boxH = 28;
  const colW = (pageWidth - 2 * margin - 6) / 2;

  // Left: Session info
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, boxY, colW, boxH, 3, 3, 'S');
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(margin, boxY, colW, boxH, 3, 3, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...mutedText);
  doc.text('DÉTAILS DE LA SESSION', margin + 5, boxY + 6);
  doc.setDrawColor(229, 231, 235);
  doc.line(margin + 5, boxY + 8, margin + colW - 5, boxY + 8);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...darkText);
  doc.text('Date :', margin + 5, boxY + 14);
  doc.setFont('helvetica', 'bold');
  doc.text(formatDateTime(session.created_at), margin + 22, boxY + 14);

  doc.setFont('helvetica', 'normal');
  doc.text('Effectué par :', margin + 5, boxY + 21);
  doc.setFont('helvetica', 'bold');
  doc.text(session.user_name || 'Inconnu', margin + 30, boxY + 21);

  // Right: Volume total
  const col2X = margin + colW + 6;
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.4);
  doc.roundedRect(col2X, boxY, colW, boxH, 3, 3, 'S');
  doc.setFillColor(236, 253, 245);
  doc.roundedRect(col2X, boxY, colW, boxH, 3, 3, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text('VOLUME TRANSFÉRÉ', col2X + 5, boxY + 6);
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.2);
  doc.line(col2X + 5, boxY + 8, col2X + colW - 5, boxY + 8);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...darkText);
  doc.text('Produits :', col2X + 5, boxY + 15);
  doc.setFont('helvetica', 'bold');
  doc.text(String(session.total_products), col2X + colW - 5, boxY + 15, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.text('Unités :', col2X + 5, boxY + 22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text(String(session.total_units), col2X + colW - 5, boxY + 22, { align: 'right' });

  // ── TABLE ──
  const tableStartY = boxY + boxH + 12;

  autoTable(doc, {
    startY: tableStartY,
    head: [['Produit', 'Lot', 'Péremption', 'Qté']],
    body: session.adjustments.map((adj) => [
      adj.produit_name || 'Produit inconnu',
      adj.lot_num || 'N/A',
      formatExpiry(adj.expiry),
      { content: `+${adj.quantity_change}`, styles: { fontStyle: 'bold', halign: 'right' } }
    ]),
    theme: 'grid',
    headStyles: {
      fillColor: [16, 185, 129],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: { top: 5, bottom: 5, left: 6, right: 6 },
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [...darkText],
      cellPadding: { top: 4, bottom: 4, left: 6, right: 6 },
    },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 35, halign: 'center' },
      2: { cellWidth: 35, halign: 'center' },
      3: { cellWidth: 25, halign: 'right' },
    },
    margin: { left: margin, right: margin },
    didDrawPage: () => {
      // Footer on every page
      doc.setFontSize(7);
      doc.setTextColor(...mutedText);
      doc.text(
        `${settings.pharmacy_name || 'PHARMACIE'} · Document généré le ${new Date().toLocaleString('fr-FR')}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: 'center' }
      );
    },
  });

  // ── SUMMARY FOOTER ──
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  if (finalY < pageHeight - 35) {
    const summaryW = 75;
    const summaryX = pageWidth - margin - summaryW;

    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.roundedRect(summaryX, finalY, summaryW, 18, 2, 2, 'S');
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(summaryX, finalY, summaryW, 18, 2, 2, 'FD');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...darkText);
    doc.text('Total produits :', summaryX + 5, finalY + 7);
    doc.setFont('helvetica', 'bold');
    doc.text(String(session.total_products), pageWidth - margin - 5, finalY + 7, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.text('Total unités :', summaryX + 5, finalY + 14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129);
    doc.text(String(session.total_units), pageWidth - margin - 5, finalY + 14, { align: 'right' });
  }

  return doc;
}
