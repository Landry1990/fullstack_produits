import axios from 'axios';
import { toast } from 'react-hot-toast';
import { safeStorage } from '../utils/storage';

const rawBaseUrl = String(import.meta.env.VITE_API_BASE_URL ?? '').trim();
const trimmedBaseUrl = rawBaseUrl.replace(/\/+$/, '');
const hasApiSuffix = trimmedBaseUrl.toLowerCase().endsWith('/api');

export const BACKEND_BASE_URL = hasApiSuffix
    ? trimmedBaseUrl.slice(0, -4)
    : trimmedBaseUrl;

export const API_BASE_URL = trimmedBaseUrl
    ? `${hasApiSuffix ? trimmedBaseUrl : `${trimmedBaseUrl}/api`}/`
    : '/api/';

export const buildBackendUrl = (path: string) => {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return BACKEND_BASE_URL ? `${BACKEND_BASE_URL}${normalizedPath}` : normalizedPath;
};

const api = axios.create({
    baseURL: API_BASE_URL,
});

let hasShownExpiredToast = false;

export const resetSessionExpiredFlag = () => {
    hasShownExpiredToast = false;
};

export const setAuthToken = (token?: string | null) => {
    if (token) {
        api.defaults.headers.common['Authorization'] = `Token ${token}`;
    } else {
        delete api.defaults.headers.common['Authorization'];
    }
};

export const clearAuthSession = () => {
    safeStorage.clear('session');
    safeStorage.removeItem('lastActivityTime', 'local');
    setAuthToken(null);
};

// Request Interceptor: Add Auth Token
api.interceptors.request.use(
    (config) => {
        const token = safeStorage.getItem('authToken');
        if (token) {
            if (!config.headers) {
                config.headers = {};
            }
            config.headers.Authorization = `Token ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response Interceptor: Handle Global Errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        const requestUrl = String(error.config?.url ?? '');

        if (status === 401) {
            const currentPath = window.location.pathname;
            const onLoginPage = currentPath === '/' || currentPath === '/login';

            if (!hasShownExpiredToast && !onLoginPage) {
                hasShownExpiredToast = true;
                toast.error('Session expirée. Veuillez vous reconnecter.', {
                    duration: 5000,
                    id: 'session-expired',
                });
            }

            clearAuthSession();

            if (!onLoginPage) {
                setTimeout(() => {
                    if (window.location.pathname !== '/') {
                        window.location.href = '/';
                    }
                }, 300);
            }
        } else if (status === 403) {
            if (!requestUrl.includes('verify-password')) {
                toast.error('Accès refusé : permissions insuffisantes', { id: 'access-denied' });
            }
        } else if (status >= 500) {
            toast.error('Erreur serveur. Réessayez plus tard.', { id: 'server-error' });
        }

        return Promise.reject(error);
    }
);

export default api;
