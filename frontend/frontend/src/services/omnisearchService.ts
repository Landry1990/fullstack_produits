import api from './api';
import type { ProduitModel, Client, Facture, Commande, Fournisseur } from '../types';

export interface GlobalSearchResponse {
    produits: ProduitModel[];
    clients: Client[];
    factures: Facture[];
    commandes: Commande[];
    fournisseurs: Fournisseur[];
}

const omnisearchService = {
    search: async (query: string, limit: number = 5, signal?: AbortSignal): Promise<GlobalSearchResponse> => {
        const response = await api.get<GlobalSearchResponse>('omnisearch/', {
            params: { q: query, limit },
            signal
        });
        return response.data;
    }
};

export default omnisearchService;
