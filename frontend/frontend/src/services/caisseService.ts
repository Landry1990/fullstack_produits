import api from './api';

const caisseService = {
    createPaiement: async (data: any): Promise<any> => {
        const response = await api.post('caisse/', data);
        return response.data;
    }
};

export default caisseService;
