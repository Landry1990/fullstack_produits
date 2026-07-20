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
  user_name: string | null;
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

export function generateReapproSessionPdfDraft(
  session: ReapproSessionData,
  settings: PharmacySettings
): jsPDF {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  let y = 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text((settings.pharmacy_name || 'PHARMACIE').toUpperCase(), margin, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  if (settings.address) { doc.text(settings.address, margin, y); y += 4; }
  if (settings.phone) { doc.text(`Tel: ${settings.phone}`, margin, y); y += 4; }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text('Confirmation de reapprovisionnement', pageWidth - margin, 18, { align: 'right' });
  doc.setFontSize(9);
  doc.text(`Session #${session.id}`, pageWidth - margin, 23, { align: 'right' });

  y = Math.max(y, 28);
  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  const boxY = y;
  const boxH = 22;
  const colW = (pageWidth - 2 * margin - 6) / 2;

  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.2);
  doc.rect(margin, boxY, colW, boxH, 'S');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text('Details de la session', margin + 4, boxY + 5);
  doc.line(margin + 4, boxY + 6.5, margin + colW - 4, boxY + 6.5);

  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text(`Date : ${formatDateTime(session.created_at)}`, margin + 4, boxY + 12);
  doc.text(`Effectue par : ${session.user_name || 'Inconnu'}`, margin + 4, boxY + 18);

  const col2X = margin + colW + 6;
  doc.rect(col2X, boxY, colW, boxH, 'S');

  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text('Volume transfere', col2X + 4, boxY + 5);
  doc.line(col2X + 4, boxY + 6.5, col2X + colW - 4, boxY + 6.5);

  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text(`Produits : ${session.total_products}`, col2X + 4, boxY + 12);
  doc.text(`Unites : ${session.total_units}`, col2X + 4, boxY + 18);

  const tableStartY = boxY + boxH + 10;

  autoTable(doc, {
    startY: tableStartY,
    head: [['Produit', 'Lot', 'Peremption', 'Qte']],
    body: session.adjustments.map((adj) => [
      adj.produit_name || 'Produit inconnu',
      adj.lot_num || 'N/A',
      formatExpiry(adj.expiry),
      { content: `+${adj.quantity_change}`, styles: { halign: 'right' } }
    ]),
    theme: 'plain',
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: 0,
      fontStyle: 'normal',
      fontSize: 9,
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [0, 0, 0],
      cellPadding: { top: 2, bottom: 2, left: 4, right: 4 },
    },
    alternateRowStyles: { fillColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 35, halign: 'center' },
      2: { cellWidth: 35, halign: 'center' },
      3: { cellWidth: 25, halign: 'right' },
    },
    margin: { left: margin, right: margin },
    didDrawPage: () => {
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.text(
        `${settings.pharmacy_name || 'PHARMACIE'} - Document genere le ${new Date().toLocaleString('fr-FR')}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: 'center' }
      );
    },
  });

  const finalY = (doc as unknown).lastAutoTable.finalY + 8;
  if (finalY < pageHeight - 30) {
    const summaryW = 70;
    const summaryX = pageWidth - margin - summaryW;
    doc.rect(summaryX, finalY, summaryW, 14, 'S');

    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(`Total produits : ${session.total_products}`, summaryX + 4, finalY + 6);
    doc.text(`Total unites : ${session.total_units}`, summaryX + 4, finalY + 11);
  }

  return doc;
}
