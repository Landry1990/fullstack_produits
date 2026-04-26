import api from './api';

const ordonnancierService = {
    create: async (data: any): Promise<any> => {
        // If data contains an image, use FormData
        if (data.image_ordonnance instanceof File) {
            const formData = new FormData();
            Object.keys(data).forEach(key => {
                if (key === 'lignes') {
                    formData.append(key, JSON.stringify(data[key]));
                } else {
                    formData.append(key, data[key]);
                }
            });
            const response = await api.post('ordonnancier/', formData);
            return response.data;
        }

        const response = await api.post('ordonnancier/', data);
        return response.data;
    }
};

export default ordonnancierService;
