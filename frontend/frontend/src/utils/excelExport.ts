import * as XLSX from 'xlsx';
import type { PharmacySettings } from '../context/PharmacySettingsContext';

export interface ExcelExportOptions {
    sheetName?: string;
    filename: string;
    title?: string;
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
    const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

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

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, filename);
}
