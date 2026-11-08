import { jsPDF } from 'jspdf';
import autoTable, { type RowInput } from 'jspdf-autotable';
import i18next from 'i18next';
import { getDocumentLanguage, getDocumentLocale } from '../documentLang';
import type { PharmacySettings } from '../../hooks/usePharmacySettings';

export interface PlanningPdfOperator {
  id: number;
  name: string;
}

export interface PlanningPdfAssignment {
  user: number;
  date: string; // YYYY-MM-DD
  shift_type: 'MATIN' | 'NUIT' | 'GARDE' | 'REPOS' | 'CONGE';
}

export interface PlanningPdfData {
  /** 1er jour du mois affiché (titre du document). */
  month: Date;
  /** Jours affichés en colonnes (mois complet ou semaine). */
  days: Date[];
  operators: PlanningPdfOperator[];
  assignments: PlanningPdfAssignment[];
}

// Lettres code — lisibles en impression noir & blanc (pas de dépendance couleur)
const SHIFT_LETTERS: Record<PlanningPdfAssignment['shift_type'], string> = {
  MATIN: 'M',
  NUIT: 'N',
  GARDE: 'G',
  REPOS: 'R',
  CONGE: 'C',
};

const formatDateISO = (d: Date) => {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * Génère le planning opérateurs en PDF — A4 paysage, pensé pour impression
 * noir & blanc : cellules = lettres code, week-ends grisés légers, légende
 * textuelle au-dessus du tableau.
 */
export function generatePlanningPdfDraft(
  data: PlanningPdfData,
  settings: PharmacySettings
): jsPDF {
  const doc = new jsPDF('l', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const docT = i18next.getFixedT(getDocumentLanguage(), 'printing');
  const docLocale = getDocumentLocale();

  // ── En-tête ──
  let y = 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text((settings.pharmacy_name || 'PHARMACIE').toUpperCase(), margin, y);
  y += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  if (settings.address) { doc.text(settings.address, margin, y); y += 3.5; }
  if (settings.phone) { doc.text(`${docT('reglement.phone_short')}${settings.phone}`, margin, y); y += 3.5; }

  // Titre à droite : PLANNING + période
  const monthLabel = data.month
    .toLocaleDateString(docLocale, { month: 'long', year: 'numeric' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(docT('planning.title'), pageWidth - margin, 12, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(
    monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
    pageWidth - margin, 17, { align: 'right' }
  );
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text(
    docT('planning.generated_on', { date: new Date().toLocaleString(docLocale) }),
    pageWidth - margin, 21, { align: 'right' }
  );

  // ── Ligne légende (lettres → libellés) ──
  y = Math.max(y, 24) + 2;
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text(`${docT('planning.legend_title')} :`, margin, y);
  doc.setFont('helvetica', 'normal');
  const legendX = margin + doc.getTextWidth(`${docT('planning.legend_title')} : `) + 1;
  doc.text(docT('planning.legend_codes'), legendX, y);

  // ── Tableau ──
  const isWeekend = data.days.map(d => d.getDay() === 0 || d.getDay() === 6);
  const weekdayRow: RowInput[] = [
    { content: docT('planning.operator'), rowSpan: 2 },
    ...data.days.map(d => ({
      content: d.toLocaleDateString(docLocale, { weekday: 'narrow' }),
      styles: { halign: 'center' as const },
    })),
  ];
  const dayRow: RowInput[] = data.days.map(d => ({
    content: `${d.getDate()}`,
    styles: { halign: 'center' as const },
  }));

  const assignmentsByCell = new Map<string, string>();
  for (const a of data.assignments) {
    const letter = SHIFT_LETTERS[a.shift_type];
    if (letter) assignmentsByCell.set(`${a.user}_${a.date}`, letter);
  }

  const body: RowInput[] = data.operators.map(op => ([
    { content: op.name, styles: { halign: 'left' as const, fontStyle: 'bold' as const } },
    ...data.days.map(day => assignmentsByCell.get(`${op.id}_${formatDateISO(day)}`) ?? ''),
  ]));

  autoTable(doc, {
    startY: y + 3,
    head: [weekdayRow, dayRow] as unknown as RowInput[],
    body,
    theme: 'grid',
    styles: {
      fontSize: 6,
      textColor: 0,
      cellPadding: 0.8,
      lineColor: [60, 60, 60],
      lineWidth: 0.15,
      minCellHeight: 4.5,
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: 0,
      fontStyle: 'bold',
      fontSize: 6,
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 38, fontSize: 7 },
    },
    margin: { left: margin, right: margin },
    didParseCell: (hookData) => {
      // Grise très légèrement les colonnes week-end (passe en N&B)
      if (hookData.column.index > 0 && isWeekend[hookData.column.index - 1]) {
        hookData.cell.styles.fillColor = [242, 242, 242];
      }
    },
    didDrawPage: () => {
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.text(
        `${settings.pharmacy_name || 'PHARMACIE'} — ${docT('planning.title')}`,
        pageWidth / 2,
        pageHeight - 5,
        { align: 'center' }
      );
    },
  });

  return doc;
}
