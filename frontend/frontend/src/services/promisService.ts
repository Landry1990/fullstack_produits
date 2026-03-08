import api from './api';
import type { Promis } from '../types';

const promisService = {
    getAll: async (): Promise<Promis[]> => {
        const response = await api.get<Promis[] | { results: Promis[] }>('promis/');
        return Array.isArray(response.data) ? response.data : (response.data.results || []);
    },

    create: async (data: any): Promise<Promis> => {
        const response = await api.post<Promis>('promis/', data);
        return response.data;
    },

    delivrer: async (id: number): Promise<void> => {
        await api.post(`promis/${id}/delivrer/`);
    },

    annulerEtReintegrer: async (id: number): Promise<any> => {
        const response = await api.post(`promis/${id}/annuler_et_reintegrer/`);
        return response.data;
    },

    imprimerTicket: async (id: number): Promise<Blob> => {
        const response = await api.get(`promis/${id}/imprimer_ticket/`, {
            responseType: 'blob'
        });
        return response.data;
    },

    sendWhatsAppReminder: async (id: number): Promise<any> => {
        const response = await api.post(`promis/${id}/send_whatsapp_reminder/`);
        return response.data;
    },

    bulkDelivrer: async (ids: number[]): Promise<any> => {
        const response = await api.post('promis/bulk_delivrer/', { ids });
        return response.data;
    },

    bulkAnnuler: async (ids: number[]): Promise<any> => {
        const response = await api.post('promis/bulk_annuler/', { ids });
        return response.data;
    }
};

export default promisService;
