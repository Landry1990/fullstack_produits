import * as XLSX from 'xlsx';
import type { PharmacySettings } from '../context/PharmacySettingsContext';
import { formatDate, formatTime } from './dateUtils';

export interface ExcelExportOptions {
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
    const now = new Date();
    const dateStr = formatDate(now.toISOString());
    const timeStr = formatTime(now.toISOString());

    const wb = XLSX.utils.book_new();

    // Construire les lignes d'en-tête
    const headerRows: (string | number)[][] = [
        [settings.pharmacy_name ?? 'ZENITH'],
        [settings.address ?? '', settings.city ?? ''],
        [settings.phone ? `Tél : ${settings.phone}` : ''],
        [`Édité le : ${dateStr} à ${timeStr}`],
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
        const colWidths = Object.keys(data[0]).map(key => {
            const headerLen = key.length;
            const maxContentLen = data.reduce((max, row) => {
                const val = String(row[key] ?? '');
                return Math.max(max, val.length);
            }, 0);
            return { wch: Math.max(headerLen, maxContentLen) + 4 };
        });
        ws['!cols'] = colWidths;
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
        } as any;
        ws['!printOptions'] = {
            gridLines: false,
            headings: false,
        } as any;
        // Marges en pouces : haut/bas 1.5cm, gauche/droite 1cm
        ws['!margins'] = {
            top: 0.59,
            bottom: 0.59,
            left: 0.39,
            right: 0.39,
            header: 0.2,
            footer: 0.2,
        } as any;
        // Répétition des lignes d'en-tête à l'impression (ligne de labels = dataStartRow + 1)
        wb.Workbook = wb.Workbook ?? { Views: [], Sheets: [] };
        const sheetIdx = wb.SheetNames.length; // sera 0 après append
        const repeatRow = dataStartRow; // ligne 0-based de l'en-tête des colonnes
        ws['!print'] = { area: undefined } as any;
        (ws as any)['!sheetPr'] = { pageSetUpPr: { fitToPage: true } };
        wb.Workbook.Sheets = wb.Workbook.Sheets ?? [];
        wb.Workbook.Sheets[sheetIdx] = { sheetId: sheetIdx + 1 } as any;
        // rowBreaks : répéter la ligne d'en-tête (via Named range dans le workbook)
        if (!wb.Workbook.Names) wb.Workbook.Names = [];
        (wb.Workbook.Names as any[]).push({
            Name: `_xlnm.Print_Titles`,
            Ref: `'${sheetName}'!$${repeatRow + 1}:$${repeatRow + 1}`,
        });
    }

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, filename);
}
