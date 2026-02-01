import AsyncStorage from '@react-native-async-storage/async-storage';
import { LigneInventaire, Inventaire } from './inventaire';

const STORAGE_KEY = 'pda_offline_lignes';

export interface OfflineLigne {
    tempId: string;
    inventaireId: number;
    produitId: number;
    produitNom: string;
    produitCip: string;
    quantiteComptee: number;
    lotNumero?: string;
    lotExpiration?: string;
    scannedAt: string;
    synced: boolean;
}

class LocalStorageService {
    /**
     * Sauvegarder une ligne localement (mode hors-ligne)
     */
    async saveLigneLocally(
        inventaire: Inventaire,
        produit: { id: number; name: string; cip1?: string },
        quantite: number,
        lotNumero?: string,
        lotExpiration?: string
    ): Promise<OfflineLigne> {
        const ligne: OfflineLigne = {
            tempId: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            inventaireId: inventaire.id,
            produitId: produit.id,
            produitNom: produit.name,
            produitCip: produit.cip1 || '',
            quantiteComptee: quantite,
            lotNumero: lotNumero,
            lotExpiration: lotExpiration,
            scannedAt: new Date().toISOString(),
            synced: false,
        };

        const existingData = await this.getOfflineLignes();
        existingData.push(ligne);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));

        return ligne;
    }

    /**
     * Récupérer toutes les lignes non synchronisées
     */
    async getOfflineLignes(): Promise<OfflineLigne[]> {
        try {
            const data = await AsyncStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Erreur lecture stockage local:', error);
            return [];
        }
    }

    /**
     * Récupérer les lignes pour un inventaire spécifique
     */
    async getLignesByInventaire(inventaireId: number): Promise<OfflineLigne[]> {
        const allLignes = await this.getOfflineLignes();
        return allLignes.filter(l => l.inventaireId === inventaireId);
    }

    /**
     * Marquer une ligne comme synchronisée
     */
    async markAsSynced(tempId: string): Promise<void> {
        const lignes = await this.getOfflineLignes();
        const updated = lignes.map(l =>
            l.tempId === tempId ? { ...l, synced: true } : l
        );
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }

    /**
     * Supprimer les lignes synchronisées
     */
    async clearSyncedLignes(): Promise<void> {
        const lignes = await this.getOfflineLignes();
        const unsyncedOnly = lignes.filter(l => !l.synced);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(unsyncedOnly));
    }

    /**
     * Supprimer une ligne locale
     */
    async removeLigne(tempId: string): Promise<void> {
        const lignes = await this.getOfflineLignes();
        const filtered = lignes.filter(l => l.tempId !== tempId);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    }

    /**
     * Compter les lignes non synchronisées
     */
    async getUnsyncedCount(): Promise<number> {
        const lignes = await this.getOfflineLignes();
        return lignes.filter(l => !l.synced).length;
    }

    /**
     * Vider complètement le stockage (pour debug/reset)
     */
    async clearAll(): Promise<void> {
        await AsyncStorage.removeItem(STORAGE_KEY);
    }
}

export const localStorageService = new LocalStorageService();
