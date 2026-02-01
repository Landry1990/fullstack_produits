import { useState, useEffect, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import {
    inventaireService,
    localStorageService,
    OfflineLigne
} from '../services';

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
                inventaire as any,
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

    // Synchroniser toutes les lignes en attente
    const syncAll = useCallback(async () => {
        if (!isOnline || offlineLignes.length === 0) return;

        setSyncing(true);
        let syncedCount = 0;

        try {
            for (const ligne of offlineLignes) {
                try {
                    await inventaireService.addLigne(ligne.inventaireId, {
                        produit: ligne.produitId,
                        quantite_comptee: ligne.quantiteComptee,
                        lot_numero: ligne.lotNumero,
                        lot_expiration: ligne.lotExpiration,
                    });
                    await localStorageService.markAsSynced(ligne.tempId);
                    syncedCount++;
                } catch (error) {
                    console.error(`Erreur sync ligne ${ligne.tempId}:`, error);
                    // Continue avec les autres lignes
                }
            }

            // Nettoyer les lignes synchronisées
            await localStorageService.clearSyncedLignes();
            await loadOfflineLignes();

            if (onSyncComplete) {
                onSyncComplete(syncedCount);
            }
        } finally {
            setSyncing(false);
        }

        return syncedCount;
    }, [isOnline, offlineLignes, onSyncComplete]);

    // Supprimer une ligne offline
    const removeOffline = useCallback(async (tempId: string) => {
        await localStorageService.removeLigne(tempId);
        setOfflineLignes(prev => prev.filter(l => l.tempId !== tempId));
    }, []);

    return {
        isOnline,
        offlineLignes,
        offlineCount: offlineLignes.length,
        syncing,
        saveOffline,
        syncAll,
        removeOffline,
        refreshOffline: loadOfflineLignes,
    };
}
