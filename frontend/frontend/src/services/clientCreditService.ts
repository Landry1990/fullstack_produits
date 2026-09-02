import api from './api';
import type {
    ClientCredit,
    ClientCreditCreatePayload,
    ClientCreditFilters,
    ClientCreditValidatePayload,
    InvoiceForCreditData,
    PaginatedResponse,
} from '../types';

export interface ClientCreditsListResponse {
    results: ClientCredit[];
    count: number;
    next: string | null;
    previous: string | null;
}

const clientCreditService = {
    getAll: async (filters: ClientCreditFilters = {}): Promise<ClientCreditsListResponse> => {
        const params = new URLSearchParams();
        if (filters.search) params.append('search', filters.search);
        if (filters.statut) params.append('statut', filters.statut);
        if (filters.client) params.append('client', filters.client.toString());
        if (filters.facture_origine) params.append('facture_origine', filters.facture_origine.toString());
        if (filters.type_motif) params.append('type_motif', filters.type_motif);
        if (filters.date_debut) params.append('date_debut', filters.date_debut);
        if (filters.date_fin) params.append('date_fin', filters.date_fin);
        if (filters.page && filters.page > 1) params.append('page', filters.page.toString());
        if (filters.page_size) params.append('page_size', filters.page_size.toString());

        const response = await api.get<ClientCredit[] | PaginatedResponse<ClientCredit>>(
            'avoirs-clients/',
            { params }
        );
        const data = response.data;
        if (Array.isArray(data)) {
            return { results: data, count: data.length, next: null, previous: null };
        }
        return {
            results: data.results || [],
            count: data.count || 0,
            next: data.next,
            previous: data.previous,
        };
    },

    getById: async (id: number): Promise<ClientCredit> => {
        const response = await api.get<ClientCredit>(`avoirs-clients/${id}/`);
        return response.data;
    },

    create: async (data: ClientCreditCreatePayload): Promise<ClientCredit> => {
        const response = await api.post<ClientCredit>('avoirs-clients/', data);
        return response.data;
    },

    update: async (id: number, data: Partial<ClientCreditCreatePayload>): Promise<ClientCredit> => {
        const response = await api.patch<ClientCredit>(`avoirs-clients/${id}/`, data);
        return response.data;
    },

    delete: async (id: number): Promise<void> => {
        await api.delete(`avoirs-clients/${id}/`);
    },

    validate: async (id: number, payload: ClientCreditValidatePayload): Promise<ClientCredit> => {
        const response = await api.post<ClientCredit>(`avoirs-clients/${id}/valider/`, payload);
        return response.data;
    },

    fromInvoice: async (factureId: number): Promise<InvoiceForCreditData> => {
        const response = await api.get<InvoiceForCreditData>('avoirs-clients/from_invoice/', {
            params: { facture_id: factureId },
        });
        return response.data;
    },

    exportExcel: async (filters: ClientCreditFilters = {}): Promise<Blob> => {
        const params = new URLSearchParams();
        if (filters.search) params.append('search', filters.search);
        if (filters.statut) params.append('statut', filters.statut);
        if (filters.client) params.append('client', filters.client.toString());
        if (filters.facture_origine) params.append('facture_origine', filters.facture_origine.toString());
        if (filters.type_motif) params.append('type_motif', filters.type_motif);
        if (filters.date_debut) params.append('date_debut', filters.date_debut);
        if (filters.date_fin) params.append('date_fin', filters.date_fin);

        const response = await api.get(`avoirs-clients/exporter_excel/`, {
            params,
            responseType: 'blob',
        });
        return response.data as Blob;
    },
};

export default clientCreditService;
