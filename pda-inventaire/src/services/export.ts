import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { LigneInventaire, Inventaire, inventaireService } from './inventaire';

class ExportService {
    /**
     * Génère un CSV à partir des lignes d'inventaire et ouvre le dialogue de partage
     */
    async exportInventaireToCsv(inventaire: Inventaire): Promise<void> {
        try {
            // 1. Récupérer toutes les lignes (pagination ?)
            // Pour l'instant on suppose que getLignes renvoie tout ou on gère la pagination si besoin.
            // Le service actuel renvoie tout pour l'instant.
            const lignes = await inventaireService.getLignes(inventaire.id);

            if (lignes.length === 0) {
                throw new Error("Aucune ligne à exporter.");
            }

            // 2. Créer le contenu CSV
            const headers = ['CIP', 'Produit', 'Quantité Comptée', 'Date Scan', 'Utilisateur'];
            const rows = lignes.map(ligne => {
                const cip = ligne.produit_cip || '';
                // Échapper les guillemets dans le nom du produit
                const nom = (ligne.produit_nom || ligne.produit_name || '').replace(/"/g, '""');
                const qte = ligne.quantite_comptee;
                const date = ligne.scanned_at || new Date().toISOString();
                // TODO: Si on avait l'info user, on la mettrait ici. Pour l'instant vide ou ID user createur inventaire
                const user = '';

                return `"${cip}","${nom}",${qte},"${date}","${user}"`;
            });

            const csvContent = [headers.join(','), ...rows].join('\n');

            // 3. Sauvegarder dans un fichier temporaire
            // Nom de fichier sécurisé
            const safeRef = inventaire.reference.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const fileName = `inventaire_${safeRef}_${inventaire.id}.csv`;
            const fileUri = FileSystem.documentDirectory + fileName;

            await FileSystem.writeAsStringAsync(fileUri, csvContent, {
                encoding: FileSystem.EncodingType.UTF8,
            });

            // 4. Partager le fichier
            const isAvailable = await Sharing.isAvailableAsync();
            if (isAvailable) {
                await Sharing.shareAsync(fileUri, {
                    mimeType: 'text/csv',
                    dialogTitle: `Exporter Inventaire ${inventaire.reference}`,
                    UTI: 'public.comma-separated-values-text' // Pour iOS
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
