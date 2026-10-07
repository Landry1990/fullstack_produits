import api, { PaginatedResponse } from './api';
import { productCacheService, CachedProduct } from './productCache';
import { useAuthStore, normalizeServerUrl } from '../stores/useAuthStore';

// Types
export interface StockLot {
    id: number;
    lot: string;
    date_expiration: string | null;
    quantity_remaining: number;
    quantity_reserved?: number;
}

export interface Produit {
    id: number;
    name: string;
    cip1: string | null;
    cip2: string | null;
    cip3: string | null;
    cip4: string | null;
    stock: number;
    selling_price: number;
    cost_price?: number; // Correspond à purchase_price
    use_lot_management?: boolean;
    stock_lots?: StockLot[];
    rayon?: { id: number; name: string };
}

export interface Inventaire {
    id: number;
    reference: string | null;
    date: string;
    created_at?: string;
    updated_at?: string;
    status: 'EN_COURS' | 'VALIDEE';
    inventory_type?: 'GLOBAL' | 'RAYON' | 'RESERVE';
    created_by: number;
    created_by_name?: string;
    lignes_count?: number;
    lignes?: LigneInventaire[];
    description?: string;
}

export interface LigneInventaire {
    id: number;
    inventaire: number;
    produit: number;
    produit_nom?: string;
    produit_cip?: string;
    stock_theorique?: number;
    quantite_physique: number;
    ecart?: number;
    stock_lot?: number;
    lot_numero?: string;
    lot_expiration?: string | null;
    scanned_at?: string;
}

export interface CreateLigneInventaire {
    produit: number;
    quantite_physique: number;
    stock_lot?: number;
    lot_numero?: string;
    lot_expiration?: string;
    mode?: 'add' | 'replace';
}

export interface StockSnapshot {
    id: number;
    stock: number;
    stock_reserve: number;
}

class InventaireService {
    /**
     * Récupérer les inventaires actifs
     */
    async getInventaires(): Promise<Inventaire[]> {
        const response = await api.get<PaginatedResponse<Inventaire> | Inventaire[]>('/inventaires/');
        return Array.isArray(response.data) ? response.data : response.data.results;
    }

    /**
     * Créer un nouvel inventaire
     */
    async createInventaire(reference: string): Promise<Inventaire> {
        const response = await api.post<Inventaire>('/inventaires/', { reference });
        return response.data;
    }

    /**
     * Récupérer les lignes d'un inventaire
     */
    async getLignes(inventaireId: number): Promise<LigneInventaire[]> {
        const response = await api.get<PaginatedResponse<LigneInventaire> | LigneInventaire[]>(
            `/inventaires/${inventaireId}/lignes/`
        );
        return Array.isArray(response.data) ? response.data : response.data.results;
    }

    /**
     * Ajouter une ligne à un inventaire
     */
    async addLigne(inventaireId: number, ligne: CreateLigneInventaire): Promise<LigneInventaire> {
        const response = await api.post<LigneInventaire>(
            `/inventaires/${inventaireId}/lignes/`,
            ligne
        );
        return response.data;
    }

    /**
     * Modifier une ligne d'inventaire
     */
    async updateLigne(inventaireId: number, ligneId: number, quantite_physique: number): Promise<LigneInventaire> {
        const response = await api.patch<LigneInventaire>(
            `/lignes-inventaire/${ligneId}/`,
            { quantite_physique }
        );
        return response.data;
    }

    /**
     * Supprimer un inventaire (soft-delete côté serveur : is_active=False).
     */
    async deleteInventaire(inventaireId: number): Promise<void> {
        await api.delete(`/inventaires/${inventaireId}/`);
    }

    /**
     * Import en masse des lignes (pour synchronisation)
     */
    /**
     * idempotencyKey : un retry réseau renvoie la même clé → le backend
     * rejoue la réponse cachée au lieu de retraiter (anti-doublon).
     */
    async bulkImport(
        inventaireId: number,
        lignes: CreateLigneInventaire[],
        idempotencyKey?: string
    ): Promise<{ imported: number; errors: string[] }> {
        const response = await api.post<{ imported: number; errors: string[] }>(
            `/inventaires/${inventaireId}/lignes/bulk/`,
            { lignes },
            idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined
        );
        return response.data;
    }
}

class ProduitService {
    /**
     * Rechercher un produit par code CIP (en ligne puis cache)
     */
    async getByCip(cip: string): Promise<Produit | null> {
        // Essayer le cache d'abord (instantané et offline)
        const cached = await productCacheService.getByCip(cip);
        if (cached) {
            return cached as Produit;
        }

        try {
            const response = await api.get<Produit>(`/produits/by-cip/${cip}/`);
            return response.data;
        } catch (error: unknown) {
            const axiosError = error as { response?: { status?: number }; message?: string };
            if (axiosError.response?.status === 404) {
                return null;
            }
            // Hors ligne et absent du cache
            if (!axiosError.response) {
                throw new Error('OFFLINE_NOT_CACHED');
            }
            throw error;
        }
    }

    /**
     * Rechercher des produits
     */
    async search(query: string): Promise<Produit[]> {
        const response = await api.get<PaginatedResponse<Produit> | Produit[]>(
            `/produits/?search=${encodeURIComponent(query)}`
        );
        return Array.isArray(response.data) ? response.data : response.data.results;
    }

    /**
     * Télécharger le catalogue complet par pages (max 500/page)
     */
    async getLots(produitId: number, inventoryType: Inventaire['inventory_type'] = 'RAYON'): Promise<StockLot[]> {
        const stockFilter = inventoryType === 'RESERVE' ? 'quantity_reserved_gt' : 'quantity_remaining_gt';
        const response = await api.get<PaginatedResponse<StockLot> | StockLot[]>(
            `/stock-lots/?produit=${produitId}&${stockFilter}=0`
        );
        return Array.isArray(response.data) ? response.data : response.data.results;
    }

    /**
     * Snapshot léger {id, stock} + curseur serveur pour la sync incrémentale.
     */
    private async fetchStocksSnapshot(): Promise<{ stocks: StockSnapshot[]; serverTime: string }> {
        const res = await api.get<{ stocks: StockSnapshot[]; server_time: string }>('/produits/stocks/');
        return { stocks: res.data.stocks || [], serverTime: res.data.server_time };
    }

    /**
     * Téléchargement complet du catalogue (première sync ou reset).
     * Snapshot stocks AVANT les pages : le server_time sert de curseur
     * conservateur — les modifications faites pendant le download seront
     * recapturées à la prochaine sync incrémentale.
     */
    async downloadCatalog(): Promise<Produit[]> {
        const { stocks, serverTime } = await this.fetchStocksSnapshot();
        const stocksMap = new Map(stocks.map(s => [s.id, s.stock]));

        const all: Produit[] = [];
        let page = 1;
        const pageSize = 500;

        while (true) {
            const response = await api.get<PaginatedResponse<Produit>>(
                `/produits/?page_size=${pageSize}&page=${page}`
            );
            const results = response.data.results || [];
            all.push(...results);

            if (!response.data.next || results.length < pageSize) {
                break;
            }
            page++;
        }

        // Garde tous les produits des pages (actifs au fetch) ; applique le
        // stock du snapshot quand présent (la purge des désactivés se fera
        // à la prochaine sync incrémentale).
        const merged = all.map(p => ({
            ...p,
            stock: stocksMap.get(p.id) ?? p.stock,
        })) as CachedProduct[];

        await productCacheService.saveAll(merged, serverTime);
        await productCacheService.setSyncedServerUrl(normalizeServerUrl(useAuthStore.getState().serverUrl));
        return merged;
    }

    /**
     * Sync incrémentale :
     * - le cache est lié à l'URL du serveur pour lequel il a été rempli :
     *   une URL différente (changement de pharmacie non détecté au login)
     *   force une purge + download complet.
     * - snapshot stocks EN PREMIER : server_time = nouveau curseur capturé
     *   avant le fetch `changed` → toute modification pendant le fetch sera
     *   recapturée à la sync suivante (pas de trou dans le curseur).
     * - `changed` = produits modifiés depuis le curseur serveur
     *   (`updated_since`), toujours conservés (actifs au fetch).
     * - les autres : stock rafraîchi via le snapshot, purge des désactivés
     *   (absents du snapshot).
     * Fallback : download complet si jamais syncé ou autre serveur.
     */
    async syncCatalog(): Promise<{ updated: number; total: number }> {
        const currentUrl = normalizeServerUrl(useAuthStore.getState().serverUrl);
        const [syncedAt, syncedUrl] = await Promise.all([
            productCacheService.getSyncedAt(),
            productCacheService.getSyncedServerUrl(),
        ]);
        if (!syncedAt || syncedUrl !== currentUrl) {
            if (syncedUrl !== null && syncedUrl !== currentUrl) {
                await productCacheService.clear();
            }
            const all = await this.downloadCatalog();
            return { updated: all.length, total: all.length };
        }

        const { stocks, serverTime } = await this.fetchStocksSnapshot();
        const stocksMap = new Map(stocks.map(s => [s.id, s.stock]));

        const changed: Produit[] = [];
        let page = 1;
        const pageSize = 500;
        while (true) {
            const response = await api.get<PaginatedResponse<Produit>>(
                `/produits/?page_size=${pageSize}&page=${page}&updated_since=${encodeURIComponent(syncedAt)}`
            );
            const results = response.data.results || [];
            changed.push(...results);
            if (!response.data.next || results.length < pageSize) {
                break;
            }
            page++;
        }

        const changedIds = new Set(changed.map(p => p.id));
        const cached = await productCacheService.getAll();
        const byId = new Map<number, CachedProduct>(cached.map(p => [p.id, p]));
        for (const p of changed) {
            byId.set(p.id, p as CachedProduct);
        }

        const merged: CachedProduct[] = [];
        for (const [id, p] of byId) {
            const stock = stocksMap.get(id);
            if (stock === undefined && !changedIds.has(id)) continue;
            merged.push(stock === undefined ? p : { ...p, stock });
        }

        await productCacheService.saveAll(merged, serverTime);
        return { updated: changed.length, total: merged.length };
    }
}

export const inventaireService = new InventaireService();
export const produitService = new ProduitService();
