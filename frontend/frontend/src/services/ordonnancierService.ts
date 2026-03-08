import api from './api';

const ordonnancierService = {
    create: async (data: any): Promise<any> => {
        const response = await api.post('ordonnancier/', data);
        return response.data;
    }
};

export default ordonnancierService;
