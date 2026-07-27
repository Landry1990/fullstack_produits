import { useState, useEffect, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { inventaireService } from '../services/inventaire';
import { localStorageService } from '../services/localStorage';
import type { OfflineLigne } from '../services/localStorage';
import type { Inventaire } from '../services/inventaire';

interface UseOfflineSyncOptions {
    inventaireId: number;
    onSyncComplete?: (count: number) => void;
}

export function useOfflineSync({ inventaireId, onSyncComplete }: UseOfflineSyncOptions) {
    const [isOnline, setIsOnline] = useState(true);
    const [offlineLignes, setOfflineLignes] = useState<OfflineLigne[]>([]);
    const [syncing, setSyncing] = useState(false);

    // Écouter les changements de connectivité
    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsOnline(state.isConnected ?? false);
        });

        // Vérification initiale
        NetInfo.fetch().then(state => {
            setIsOnline(state.isConnected ?? false);
        });

        return () => unsubscribe();
    }, []);

    // Charger les lignes hors-ligne au démarrage
    useEffect(() => {
        loadOfflineLignes();
    }, [inventaireId]);

    const loadOfflineLignes = async () => {
        try {
            const lignes = await localStorageService.getLignesByInventaire(inventaireId);
            setOfflineLignes(lignes.filter(l => !l.synced));
        } catch (error) {
            console.error('Erreur chargement lignes offline:', error);
        }
    };

    // Sauvegarder une ligne localement
    const saveOffline = useCallback(async (
        produit: { id: number; name: string; cip1?: string },
        quantite: number,
        inventaire: { id: number; reference?: string },
        lotNumero?: string,
        lotExpiration?: string
    ) => {
        try {
            const ligne = await localStorageService.saveLigneLocally(
                { id: inventaire.id, reference: inventaire.reference || '', date_debut: '', date_fin: null, statut: 'EN_COURS', created_by: 0, lignes_count: 0 } as Inventaire,
                produit,
                quantite,
                lotNumero,
                lotExpiration
            );
            setOfflineLignes(prev => [...prev, ligne]);
            return ligne;
        } catch (error) {
            console.error('Erreur sauvegarde offline:', error);
            throw error;
        }
    }, []);

    // Synchroniser toutes les lignes en attente (envoi groupé)
    const syncAll = useCallback(async () => {
        if (!isOnline || offlineLignes.length === 0) return;

        setSyncing(true);
        let syncedCount = 0;

        try {
            // Préparer toutes les lignes pour un seul envoi groupé
            const lignesPayload = offlineLignes.map(l => ({
                produit: l.produitId,
                quantite_comptee: l.quantiteComptee,
                lot_numero: l.lotNumero,
                lot_expiration: l.lotExpiration,
            }));

            const result = await inventaireService.bulkImport(inventaireId, lignesPayload);
            syncedCount = result.imported;

            // Marquer toutes les lignes comme synchronisées
            await Promise.all(offlineLignes.map(ligne =>
                localStorageService.markAsSynced(ligne.tempId)
            ));

            // Nettoyer les lignes synchronisées
            await localStorageService.clearSyncedLignes();
            await loadOfflineLignes();

            if (onSyncComplete) {
                onSyncComplete(syncedCount);
            }
        } catch (error) {
            console.error('Erreur sync groupée:', error);
            if (onSyncComplete) {
                onSyncComplete(0);
            }
        } finally {
            setSyncing(false);
        }

        return syncedCount;
    }, [isOnline, offlineLignes, onSyncComplete, inventaireId]);

    // Supprimer une ligne offline
    const removeOffline = useCallback(async (tempId: string) => {
        await localStorageService.removeLigne(tempId);
        setOfflineLignes(prev => prev.filter(l => l.tempId !== tempId));
    }, []);

    // Mettre à jour une ligne offline (quantité)
    const updateOffline = useCallback(async (tempId: string, newQuantity: number) => {
        await localStorageService.updateLigne(tempId, newQuantity);
        setOfflineLignes(prev => prev.map(l => 
            l.tempId === tempId ? { ...l, quantiteComptee: newQuantity } : l
        ));
    }, []);

    return {
        isOnline,
        offlineLignes,
        offlineCount: offlineLignes.length,
        syncing,
        saveOffline,
        syncAll,
        removeOffline,
        updateOffline,
        refreshOffline: loadOfflineLignes,
    };
}
