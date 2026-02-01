import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Inventaire, inventaireService } from './inventaire';

// Workaround pour les types si nécessaire, mais legacy devrait avoir les bonnes méthodes
const FS = FileSystem;
const Share = Sharing;

class ExportService {
    /**
     * Génère un CSV à partir des lignes d'inventaire et ouvre le dialogue de partage
     */
    async exportInventaireToCsv(inventaire: Inventaire): Promise<void> {
        try {
            // 1. Récupérer toutes les lignes
            const lignes = await inventaireService.getLignes(inventaire.id);

            if (lignes.length === 0) {
                throw new Error("Aucune ligne à exporter.");
            }

            // 2. Créer le contenu CSV
            const headers = ['CIP', 'Produit', 'Quantité Comptée', 'Date Scan'];
            const rows = lignes.map(ligne => {
                const cip = ligne.produit_cip || '';
                const nom = (ligne.produit_nom || ligne.produit_name || `Produit #${ligne.produit}`).replace(/"/g, '""');
                const qte = ligne.quantite_comptee;
                const date = ligne.scanned_at || new Date().toISOString();

                return `"${cip}","${nom}",${qte},"${date}"`;
            });

            const csvContent = [headers.join(','), ...rows].join('\n');

            // 3. Sauvegarder dans un fichier temporaire
            const refName = inventaire.reference || `inv_${inventaire.id}`;
            const safeRef = refName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const fileName = `inventaire_${safeRef}_${inventaire.id}.csv`;
            const fileUri = FS.documentDirectory + fileName;

            await FS.writeAsStringAsync(fileUri, csvContent, {
                encoding: FS.EncodingType?.UTF8 || 'utf8',
            });

            // 4. Partager le fichier
            const canShare = await Share.isAvailableAsync();
            if (canShare) {
                await Share.shareAsync(fileUri, {
                    mimeType: 'text/csv',
                    dialogTitle: `Exporter Inventaire ${inventaire.reference || 'Inventaire'}`,
                    UTI: 'public.comma-separated-values-text'
                });
            } else {
                throw new Error("Le partage n'est pas disponible sur cet appareil.");
            }

        } catch (error) {
            console.error("Erreur export CSV:", error);
            throw error;
        }
    }
}

export const exportService = new ExportService();
