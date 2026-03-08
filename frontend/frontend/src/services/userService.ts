import api from './api';

export interface SimpleUser {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
}

const userService = {
    getAll: async (): Promise<SimpleUser[]> => {
        const response = await api.get<SimpleUser[] | { results: SimpleUser[] }>('users/');
        return Array.isArray(response.data) ? response.data : (response.data.results || []);
    }
};

export default userService;
