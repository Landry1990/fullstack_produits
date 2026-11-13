import api from './api';

export interface TreatmentReminder {
    id: number;
    client: number;
    client_name: string;
    client_phone: string;
    produit: number | null;
    produit_nom: string;
    produit_stock: number | null;
    date_debut: string;
    quantite: number | null;
    doses_par_jour: string | null;
    duree_jours: number;
    date_fin_prevue: string;
    jours_restants: number;
    statut: 'EN_ATTENTE' | 'TRAITE' | 'PATIENT_INFORME' | 'IGNORE';
    statut_display: string;
    notes: string;
    created_by_name: string | null;
    created_at: string;
}

export interface TreatmentReminderPayload {
    client: number;
    produit?: number | null;
    produit_nom?: string;
    date_debut: string;
    quantite?: number | null;
    doses_par_jour?: number | null;
    duree_jours?: number | null;
    notes?: string;
}

interface PaginatedResponse<T> {
    results: T[];
    count: number;
}

export interface DuePromis {
    id: number;
    type: 'promis';
    client: string;
    client_phone: string;
    produit_nom: string;
    quantite: number;
}

export interface DueResponse {
    actif: boolean;
    jours_avant?: number;
    rappels: TreatmentReminder[];
    promis: DuePromis[];
}

const BASE = 'rappels-traitement/';

export const treatmentReminderService = {
    getAll: async (params: { statut?: string; client?: number; produit?: number } = {}): Promise<TreatmentReminder[]> => {
        const all: TreatmentReminder[] = [];
        let page = 1;
        for (;;) {
            const res = await api.get<PaginatedResponse<TreatmentReminder> | TreatmentReminder[]>(BASE, {
                params: { ...params, page_size: 100, page },
            });
            const data = res.data;
            if (Array.isArray(data)) { all.push(...data); break; }
            all.push(...data.results);
            if (!data.next) break;
            page += 1;
        }
        return all;
    },

    getDue: async (): Promise<DueResponse> => {
        const res = await api.get<DueResponse>(`${BASE}due/`);
        return res.data;
    },

    create: async (payload: TreatmentReminderPayload): Promise<TreatmentReminder> => {
        const res = await api.post<TreatmentReminder>(BASE, payload);
        return res.data;
    },

    update: async (id: number, payload: Partial<TreatmentReminderPayload>): Promise<TreatmentReminder> => {
        const res = await api.patch<TreatmentReminder>(`${BASE}${id}/`, payload);
        return res.data;
    },

    traiter: async (id: number): Promise<TreatmentReminder> => {
        const res = await api.post<TreatmentReminder>(`${BASE}${id}/traiter/`);
        return res.data;
    },

    patientInforme: async (id: number): Promise<TreatmentReminder> => {
        const res = await api.post<TreatmentReminder>(`${BASE}${id}/patient_informe/`);
        return res.data;
    },

    ignorer: async (id: number): Promise<TreatmentReminder> => {
        const res = await api.post<TreatmentReminder>(`${BASE}${id}/ignorer/`);
        return res.data;
    },

    remove: async (id: number): Promise<void> => {
        await api.delete(`${BASE}${id}/`);
    },
};
