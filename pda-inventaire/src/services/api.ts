import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL, REQUEST_TIMEOUT, STORAGE_KEYS } from '../config';

// Instance Axios configurée
const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: REQUEST_TIMEOUT,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Callback pour gérer les erreurs 401 globalement
let onUnauthorizedCallback: (() => void) | null = null;

export const setUnauthorizedCallback = (callback: () => void) => {
    onUnauthorizedCallback = callback;
};

// Intercepteur pour ajouter le token à chaque requête
api.interceptors.request.use(
    async (config) => {
        try {
            const token = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
            if (token) {
                config.headers.Authorization = `Token ${token}`;
            }
        } catch (error) {
            console.warn('Erreur lecture token:', error);
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Intercepteur pour gérer les erreurs (401 = déconnexion)
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            // Token expiré ou invalide
            try {
                await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
                await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_INFO);
            } catch (e) {}

            // Déclencher le callback de déconnexion si disponible
            if (onUnauthorizedCallback) {
                onUnauthorizedCallback();
            }
        }
        return Promise.reject(error);
    }
);

export default api;

// Types pour les réponses API
export interface ApiResponse<T> {
    data: T;
    message?: string;
}

export interface PaginatedResponse<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}
