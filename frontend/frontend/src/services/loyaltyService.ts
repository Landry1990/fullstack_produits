import api from './api';
import type { LoyaltyHistoryEntry, LoyaltySettings } from '../types';

export const loyaltyService = {
    getHistory: (params?: { client?: number; type_transaction?: string; page?: number }) =>
        api.get('loyalty-history/', { params }).then(res => res.data),
    getSettings: () =>
        api.get('loyalty-settings/').then(res => {
            let data = res.data;
            if (data?.results) data = data.results[0];
            else if (Array.isArray(data)) data = data[0];
            return data as LoyaltySettings;
        }),
    saveSettings: (settings: LoyaltySettings) =>
        settings.id ? api.put(`loyalty-settings/${settings.id}/`, settings) : api.post('loyalty-settings/', settings),
};

export default loyaltyService;
