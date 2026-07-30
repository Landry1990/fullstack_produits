import { jsPDF } from 'jspdf';
import autoTable, { type RowInput } from 'jspdf-autotable';
import { formatCurrency } from '../formatters';
import { getLocale } from '../dateUtils';
import type { PharmacySettings } from '../../context/PharmacySettingsContext';

interface StockValuationData {
  is_pmp: boolean;
  type_valorisation: string;
  total_ht: number | string;
  total_tva: number | string;
  total_ttc: number | string;
  tva_breakdown: {
    rate: number;
    ht: number | string;
    tva: number | string;
    ttc: number | string;
  }[];
  group_by?: string;
  group_breakdown?: {
    name: string;
    ht: number | string;
    tva: number | string;
    ttc: number | string;
  }[];
  date: string;
}

export function generateStockValuationPdf(
  data: StockValuationData,
  settings: PharmacySettings
) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const currentLocale = getLocale();
  const currencySymbol = settings.currency_symbol || 'FCFA';

  const fmt = (val: number | string | undefined | null) => {
    const n = Number(val ?? 0);
    return formatCurrency(Math.round(n), currentLocale, currencySymbol)
      .replace(/[\u00A0\u202F]/g, ' ');
  };

  const _typeLabel = data.is_pmp ? "Coût d'Achat (PMP)" : 'Prix de Vente (TTC)';
  const docTitle = `Valeur Stock (${data.is_pmp ? 'PMP' : 'VENTE'})`;

  // --- Header ---
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(settings.pharmacy_name, margin, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  let headerY = 26;
  if (settings.address) { doc.text(settings.address, margin, headerY); headerY += 4; }
  if (settings.phone) { doc.text(`Tél: ${settings.phone}`, margin, headerY); headerY += 4; }
  if (settings.niu) { doc.text(`NIU: ${settings.niu}`, margin, headerY); headerY += 4; }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  doc.text(docTitle, pageWidth - margin, 20, { align: 'right' });
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  const dateStr = data.date
    ? new Date(data.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleString('fr-FR');
  doc.text(dateStr, pageWidth - margin, 26, { align: 'right' });

  doc.setDrawColor(200, 200, 200);
  doc.line(margin, headerY + 2, pageWidth - margin, headerY + 2);

  // --- Summary Section ---
  let currentY = headerY + 10;
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text('RÉCAPITULATIF GÉNÉRAL', margin, currentY);
  currentY += 5;

  const summaryBody: unknown[][] = [
    ['Valeur Totale HT', fmt(data.total_ht)],
    ['Montant Total TVA', fmt(data.total_tva)],
    [`Valeur Totale ${data.is_pmp ? 'PMP' : 'TTC'}`, fmt(data.total_ttc)],
  ];

  autoTable(doc, {
    startY: currentY,
    body: summaryBody as unknown as RowInput[],
    theme: 'plain',
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, lineColor: [200, 200, 200], lineWidth: 0.1 },
    columnStyles: { 0: { cellWidth: 80 }, 1: { halign: 'right' } },
  });
  currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // --- TVA Breakdown ---
  doc.setFontSize(11);
  doc.text('RÉPARTITION PAR TAUX DE TVA', margin, currentY);
  currentY += 5;

  const tvaBody: unknown[][] = data.tva_breakdown.map(item => [
    `${item.rate}%`,
    fmt(item.ht),
    fmt(item.tva),
    fmt(item.ttc),
  ]);
  tvaBody.push([
    { content: 'TOTAL', styles: { fontStyle: 'normal' } },
    { content: fmt(data.total_ht), styles: { fontStyle: 'normal' } },
    { content: fmt(data.total_tva), styles: { fontStyle: 'normal' } },
    { content: fmt(data.total_ttc), styles: { fontStyle: 'normal' } },
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Taux TVA', 'Base HT', 'Montant TVA', 'Total Reconstitué']],
    body: tvaBody as unknown as RowInput[],
    theme: 'plain',
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'normal' },
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, lineColor: [200, 200, 200], lineWidth: 0.1 },
    columnStyles: {
      0: { halign: 'left' },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
    },
  });
  currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // --- Group Breakdown (if present) ---
  if (data.group_breakdown && data.group_breakdown.length > 0) {
    if (currentY > 240) { doc.addPage(); currentY = 20; }

    const groupLabel = data.group_by === 'rayon' ? 'Rayon'
      : data.group_by === 'forme' ? 'Forme'
      : data.group_by === 'groupe' ? 'Groupe'
      : 'Catégorie';

    doc.setFontSize(11);
    doc.text(`RÉPARTITION PAR ${groupLabel.toUpperCase()}`, margin, currentY);
    currentY += 5;

    const groupBody: unknown[][] = data.group_breakdown.map(item => [
      item.name,
      fmt(item.ht),
      fmt(item.tva),
      fmt(item.ttc),
    ]);
    groupBody.push([
      { content: 'TOTAL', styles: { fontStyle: 'normal' } },
      { content: fmt(data.total_ht), styles: { fontStyle: 'normal' } },
      { content: fmt(data.total_tva), styles: { fontStyle: 'normal' } },
      { content: fmt(data.total_ttc), styles: { fontStyle: 'normal' } },
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [[groupLabel, 'Base HT', 'Montant TVA', 'Total TTC']],
      body: groupBody as unknown as RowInput[],
      theme: 'plain',
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'normal' },
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, lineColor: [200, 200, 200], lineWidth: 0.1 },
      columnStyles: {
        0: { halign: 'left' },
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
      },
    });
    currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // --- Note ---
  if (currentY > 250) { doc.addPage(); currentY = 20; }
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  const noteText = data.is_pmp
    ? "Note : Cette valorisation est fondée sur le PMP stocké en base."
    : "Note : Cette valorisation est fondée sur les prix de vente publics actuels.";
  doc.text(noteText, margin, currentY);

  // --- Footer on all pages ---
  const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `${settings.pharmacy_name} · Récapitulatif Valeur Stock · Page ${i} / ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }

  const filename = `recap_valeur_stock_${data.is_pmp ? 'pmp' : 'vente'}.pdf`;
  doc.save(filename);
}
