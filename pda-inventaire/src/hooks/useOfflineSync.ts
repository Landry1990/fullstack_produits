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

const BATCH_SIZE = 50;
const MAX_RETRIES = 3;

const chunk = <T,>(arr: T[], size: number): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        out.push(arr.slice(i, i + size));
    }
    return out;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Id unique par batch (stable entre les retries → idempotence côté backend).
const newBatchId = (inventaireId: number) =>
    `b${inventaireId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;

// Erreur réseau/timeout ou 5xx → on peut réessayer. 4xx (donnée, auth) → inutile.
const isRetryableError = (err: unknown) => {
    const status = (err as { response?: { status?: number } })?.response?.status;
    return status === undefined || status >= 500;
};

// Extrait l'index des lignes en échec renvoyé par le backend ("Ligne 0: ...").
const parseErrorIndices = (errors: string[] | undefined): Set<number> => {
    const set = new Set<number>();
    for (const e of errors ?? []) {
        const m = e.match(/^Ligne (\d+):/);
        if (m) set.add(Number(m[1]));
    }
    return set;
};

export function useOfflineSync({ inventaireId, onSyncComplete }: UseOfflineSyncOptions) {
    const [isOnline, setIsOnline] = useState(true);
    const [offlineLignes, setOfflineLignes] = useState<OfflineLigne[]>([]);
    const [syncing, setSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null);

    // Écouter les changements de connectivité
    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsOnline(state.isConnected === true && state.isInternetReachable !== false);
        });

        // Vérification initiale
        NetInfo.fetch().then(state => {
            setIsOnline(state.isConnected === true && state.isInternetReachable !== false);
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

    // Sauvegarder une ligne localement (agrège si même produit + lot)
    const saveOffline = useCallback(async (
        produit: { id: number; name: string; cip1?: string },
        quantite: number,
        inventaire: { id: number; reference?: string | null },
        stockTheorique: number,
        stockLotId?: number,
        lotNumero?: string,
        lotExpiration?: string,
        replaceExisting = false
    ) => {
        try {
            // Rechercher une ligne existante pour ce produit + lot
            const existingLignes = await localStorageService.getLignesByInventaire(inventaire.id);
            const matching = existingLignes.find(l =>
                l.produitId === produit.id &&
                l.stockLotId === (stockLotId ?? undefined) &&
                l.lotNumero === (lotNumero ?? undefined) &&
                l.lotExpiration === (lotExpiration ?? undefined) &&
                !l.synced
            );

            if (matching) {
                const newQty = replaceExisting ? quantite : matching.quantiteComptee + quantite;
                await localStorageService.updateLigne(
                    matching.tempId,
                    newQty,
                    stockTheorique,
                    replaceExisting ? 'replace' : matching.syncMode
                );
                const updated: OfflineLigne = {
                    ...matching,
                    quantiteComptee: newQty,
                    stockTheorique,
                    syncMode: replaceExisting ? 'replace' : matching.syncMode,
                };
                setOfflineLignes(prev => prev.map(l =>
                    l.tempId === matching.tempId ? updated : l
                ));
                return updated;
            }

            const ligne = await localStorageService.saveLigneLocally(
                { id: inventaire.id, reference: inventaire.reference || '', date: '', status: 'EN_COURS', created_by: 0 } as Inventaire,
                produit,
                quantite,
                stockTheorique,
                stockLotId,
                lotNumero,
                lotExpiration,
                replaceExisting ? 'replace' : 'add'
            );
            setOfflineLignes(prev => [...prev, ligne]);
            return ligne;
        } catch (error) {
            console.error('Erreur sauvegarde offline:', error);
            throw error;
        }
    }, []);

    // Synchroniser les lignes en attente par batches, avec retry réseau
    const syncAll = useCallback(async () => {
        if (!isOnline || offlineLignes.length === 0) return;

        setSyncing(true);
        setSyncProgress({ current: 0, total: offlineLignes.length });
        let syncedCount = 0;
        const batches = chunk(offlineLignes, BATCH_SIZE);

        const sendBatch = async (batch: OfflineLigne[]) => {
            // Généré AVANT la boucle de retry : un retry après une coupure
            // post-traitement rejoue la réponse cachée au lieu de doubler
            // les quantités (mode 'add' non idempotent côté serveur).
            const batchId = newBatchId(inventaireId);
            const payload = batch.map(l => ({
                produit: l.produitId,
                quantite_physique: l.quantiteComptee,
                stock_lot: l.stockLotId,
                lot_numero: l.lotNumero,
                lot_expiration: l.lotExpiration,
                mode: l.syncMode || 'add',
            }));

            let lastErr: unknown = null;
            for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
                try {
                    return await inventaireService.bulkImport(inventaireId, payload, batchId);
                } catch (err) {
                    lastErr = err;
                    if (!isRetryableError(err) || attempt === MAX_RETRIES - 1) {
                        throw err;
                    }
                    await sleep(1000 * (attempt + 1)); // 1s, 2s
                }
            }
            throw lastErr;
        };

        try {
            for (const batch of batches) {
                const result = await sendBatch(batch);
                const errorIndices = parseErrorIndices(result.errors);

                if (result.imported === batch.length) {
                    // Batch entièrement importé
                    await Promise.all(batch.map(l => localStorageService.markAsSynced(l.tempId)));
                    syncedCount += result.imported;
                } else if (result.errors?.length && errorIndices.size === batch.length - result.imported) {
                    // Sync partielle : on sait quelles lignes ont échoué
                    await Promise.all(batch.map((l, idx) =>
                        errorIndices.has(idx)
                            ? Promise.resolve()
                            : localStorageService.markAsSynced(l.tempId)
                    ));
                    syncedCount += result.imported;
                } else {
                    // Incertitude sur les lignes en échec : tout garder en attente
                    throw new Error(result.errors?.join('\n') || `Importé ${result.imported} / ${batch.length}`);
                }

                setSyncProgress({ current: syncedCount, total: offlineLignes.length });
            }

            await localStorageService.clearSyncedLignes();
            await loadOfflineLignes();

            if (onSyncComplete) {
                onSyncComplete(syncedCount);
            }
        } catch (error) {
            console.error('Erreur sync groupée:', error);
            await loadOfflineLignes();
            if (onSyncComplete) {
                onSyncComplete(syncedCount);
            }
        } finally {
            setSyncing(false);
            setSyncProgress(null);
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
        syncProgress,
        saveOffline,
        syncAll,
        removeOffline,
        updateOffline,
        refreshOffline: loadOfflineLignes,
    };
}
