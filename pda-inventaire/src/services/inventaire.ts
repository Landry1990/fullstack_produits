import api, { PaginatedResponse } from './api';
import { productCacheService } from './productCache';

// Types
export interface StockLot {
    id: number;
    lot: string;
    date_expiration: string | null;
    quantity_remaining: number;
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
    reference: string;
    date_debut: string;
    date_fin: string | null;
    statut: 'EN_COURS' | 'TERMINE' | 'VALIDE';
    created_by: number;
    lignes_count: number;
}

export interface LigneInventaire {
    id: number;
    inventaire: number;
    produit: number;
    produit_nom?: string;
    produit_name?: string;
    produit_cip?: string;
    quantite_theorique: number;
    quantite_comptee: number;
    ecart: number;
    lot_numero?: string;
    lot_expiration?: string;
    scanned_at?: string;
}

export interface CreateLigneInventaire {
    produit: number;
    quantite_comptee: number;
    lot_numero?: string;
    lot_expiration?: string;
}

class InventaireService {
    /**
     * Récupérer les inventaires actifs
     */
    async getInventaires(): Promise<Inventaire[]> {
        const response = await api.get<PaginatedResponse<Inventaire> | Inventaire[]>('/api/inventaires/');
        return Array.isArray(response.data) ? response.data : response.data.results;
    }

    /**
     * Créer un nouvel inventaire
     */
    async createInventaire(reference: string): Promise<Inventaire> {
        const response = await api.post<Inventaire>('/api/inventaires/', { reference });
        return response.data;
    }

    /**
     * Récupérer les lignes d'un inventaire
     */
    async getLignes(inventaireId: number): Promise<LigneInventaire[]> {
        const response = await api.get<PaginatedResponse<LigneInventaire> | LigneInventaire[]>(
            `/api/inventaires/${inventaireId}/lignes/`
        );
        return Array.isArray(response.data) ? response.data : response.data.results;
    }

    /**
     * Ajouter une ligne à un inventaire
     */
    async addLigne(inventaireId: number, ligne: CreateLigneInventaire): Promise<LigneInventaire> {
        const response = await api.post<LigneInventaire>(
            `/api/inventaires/${inventaireId}/lignes/`,
            ligne
        );
        return response.data;
    }

    /**
     * Modifier une ligne d'inventaire
     */
    async updateLigne(inventaireId: number, ligneId: number, quantite_comptee: number): Promise<LigneInventaire> {
        const response = await api.patch<LigneInventaire>(
            `/api/lignes-inventaire/${ligneId}/`,
            { quantite_comptee }
        );
        return response.data;
    }

    /**
     * Import en masse des lignes (pour synchronisation)
     */
    async bulkImport(inventaireId: number, lignes: CreateLigneInventaire[]): Promise<{ imported: number; errors: string[] }> {
        const response = await api.post<{ imported: number; errors: string[] }>(
            `/api/inventaires/${inventaireId}/lignes/bulk/`,
            { lignes }
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
            const response = await api.get<Produit>(`/api/produits/by-cip/${cip}/`);
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
            `/api/produits/?search=${encodeURIComponent(query)}`
        );
        return Array.isArray(response.data) ? response.data : response.data.results;
    }

    /**
     * Télécharger le catalogue complet par pages (max 500/page)
     */
    async downloadCatalog(): Promise<Produit[]> {
        const all: Produit[] = [];
        let page = 1;
        const pageSize = 500;

        while (true) {
            const response = await api.get<PaginatedResponse<Produit>>(
                `/api/produits/?page_size=${pageSize}&page=${page}`
            );
            const results = response.data.results || [];
            all.push(...results);

            if (!response.data.next || results.length < pageSize) {
                break;
            }
            page++;
        }

        await productCacheService.saveAll(all);
        return all;
    }
}

export const inventaireService = new InventaireService();
export const produitService = new ProduitService();
