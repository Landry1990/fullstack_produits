import * as XLSX from 'xlsx';
import i18next from 'i18next';
import type { PharmacySettings } from '../context/PharmacySettingsContext';
import { formatDate, formatTime } from './dateUtils';
import { getDocumentLanguage } from './documentLang';

/** Largeur maximale d'une colonne (en caractères). */
const MAX_COL_WIDTH = 50;

export function fitExcelColumns(ws: XLSX.WorkSheet, startRow = 0): void {
    if (!ws['!ref']) return;
    const range = XLSX.utils.decode_range(ws['!ref']);
    const merges = ws['!merges'] ?? [];
    const widths = Array.from({ length: range.e.c + 1 }, () => 0);
    for (let r = Math.max(startRow, range.s.r); r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
            if (merges.some(merge => r >= merge.s.r && r <= merge.e.r && c >= merge.s.c && c <= merge.e.c)) continue;
            const cell = ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
            if (!cell) continue;
            const text = XLSX.utils.format_cell(cell);
            widths[c] = Math.max(widths[c], ...text.split(/\r?\n/).map(line => line.length));
        }
    }
    ws['!cols'] = widths.map(width => ({ wch: Math.min(width + 2, MAX_COL_WIDTH) }));
}

interface ExcelExportOptions {
    sheetName?: string;
    filename: string;
    title?: string;
    printA4Portrait?: boolean;
}

/**
 * Télécharge un blob (Excel, CSV…) reçu d'une réponse axios.
 * Centralise le pattern : createObjectURL → clic → revoke.
 *
 * @param blobData     - Le contenu binaire (response.data avec responseType:'blob')
 * @param filename     - Nom du fichier à proposer au téléchargement
 * @param mimeType     - Type MIME (défaut : xlsx)
 */
export function downloadBlob(
    blobData: BlobPart,
    filename: string,
    mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
): void {
    const url = window.URL.createObjectURL(new Blob([blobData], { type: mimeType }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
}

/**
 * Crée un fichier Excel avec un en-tête pharmacie (nom, ville, date d'export)
 * puis les données tabulaires, et déclenche le téléchargement.
 */
export function exportToExcel(
    data: Record<string, string | number | boolean>[],
    settings: Pick<PharmacySettings, 'pharmacy_name' | 'address' | 'city' | 'phone'>,
    options: ExcelExportOptions
): void {
    const { sheetName = 'Export', filename, title } = options;
    const docT = i18next.getFixedT(getDocumentLanguage(), 'printing');
    const now = new Date();
    const dateStr = formatDate(now.toISOString());
    const timeStr = formatTime(now.toISOString());

    const wb = XLSX.utils.book_new();

    // Construire les lignes d'en-tête
    const headerRows: (string | number)[][] = [
        [settings.pharmacy_name ?? 'ZENITH'],
        [settings.address ?? '', settings.city ?? ''],
        [settings.phone ? docT('export.tel', { phone: settings.phone }) : ''],
        [docT('export.edited_on', { date: dateStr, time: timeStr })],
        [],
    ];
    if (title) {
        headerRows.push([title]);
        headerRows.push([]);
    }

    // Créer la feuille à partir des lignes d'en-tête
    const ws = XLSX.utils.aoa_to_sheet(headerRows);

    // Ajouter les données après l'en-tête
    const dataStartRow = headerRows.length;
    XLSX.utils.sheet_add_json(ws, data, { origin: dataStartRow, skipHeader: false });

    // Largeur automatique des colonnes (basée sur le contenu des données)
    if (data.length > 0) {
        // +2 de marge (au lieu de +4, trop aéré) et plafond pour les textes très longs.
        fitExcelColumns(ws, dataStartRow);
    }

    if (options.printA4Portrait) {
        // Mise en page A4 portrait — 1 page de large, autant de pages en hauteur que nécessaire
        ws['!pageSetup'] = {
            paperSize: 9,        // 9 = A4
            orientation: 'portrait',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,      // 0 = illimité en hauteur
            scale: 100,
        } as unknown;
        ws['!printOptions'] = {
            gridLines: false,
            headings: false,
        } as unknown;
        // Marges en pouces : haut/bas 1.5cm, gauche/droite 1cm
        ws['!margins'] = {
            top: 0.59,
            bottom: 0.59,
            left: 0.39,
            right: 0.39,
            header: 0.2,
            footer: 0.2,
        } as XLSX.MarginInfo;
        // Répétition des lignes d'en-tête à l'impression (ligne de labels = dataStartRow + 1)
        wb.Workbook = wb.Workbook ?? { Views: [], Sheets: [] };
        const sheetIdx = wb.SheetNames.length; // sera 0 après append
        const repeatRow = dataStartRow; // ligne 0-based de l'en-tête des colonnes
        ws['!print'] = { area: undefined } as unknown;
        (ws as Record<string, unknown>)['!sheetPr'] = { pageSetUpPr: { fitToPage: true } };
        wb.Workbook.Sheets = wb.Workbook.Sheets ?? [];
        wb.Workbook.Sheets[sheetIdx] = { sheetId: sheetIdx + 1 } as XLSX.SheetProps;
        // rowBreaks : répéter la ligne d'en-tête (via Named range dans le workbook)
        if (!wb.Workbook.Names) wb.Workbook.Names = [];
        (wb.Workbook.Names as unknown[]).push({
            Name: `_xlnm.Print_Titles`,
            Ref: `'${sheetName}'!$${repeatRow + 1}:$${repeatRow + 1}`,
        });
    }

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, filename);
}
