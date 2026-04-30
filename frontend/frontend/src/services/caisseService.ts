import api from './api';
import type { CaisseTransaction } from '../types';

export interface PaiementData {
    facture_id: number;
    mode_paiement: string;
    montant: string | number;
    reference?: string | null;
    poste_caisse_id?: number | null;
    releve_id?: number | null;
}

const caisseService = {
    createPaiement: async (data: PaiementData): Promise<CaisseTransaction> => {
        const response = await api.post<CaisseTransaction>('caisse/', data);
        return response.data;
    }
};

export default caisseService;
