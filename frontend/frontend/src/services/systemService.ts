import api from './api';

export interface AppVersion {
    version: string;
    commit: string | null;
    commit_date: string | null;
}

const systemService = {
    getVersion: async (): Promise<AppVersion> => {
        const response = await api.get<AppVersion>('version/');
        return response.data;
    },
};

export default systemService;
