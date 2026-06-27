import axios from 'axios';
import { toast } from 'react-hot-toast';
import { safeStorage } from '../utils/storage';
import * as navigationService from './navigationService';

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

const TIMEOUT_MS = 15000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: TIMEOUT_MS,
});

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isNetworkError = (error: any): boolean => {
    return !error.response && (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED' || error.message === 'Network Error');
};

const isRetryableRequest = (error: any): boolean => {
    // Retry sur erreurs réseau (connexion perdue, timeout) et erreurs serveur temporaires
    const status = error.response?.status;
    const isServerTempUnavailable = status === 502 || status === 503 || status === 504;
    return isNetworkError(error) || isServerTempUnavailable;
};

let hasShownExpiredToast = false;
let hasShownOfflineToast = false;

window.addEventListener('online', () => {
    hasShownOfflineToast = false;
    toast.success('Connexion rétablie.', { id: 'back-online', duration: 3000 });
});

window.addEventListener('offline', () => {
    toast.error('Connexion perdue. Vérifiez le réseau.', { id: 'offline-warning', duration: 0 });
});

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
            config.headers.Authorization = `Token ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response Interceptor: Handle Global Errors + Retry réseau
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const config = error.config;

        // Retry automatique sur les GET en cas de coupure réseau (jamais sur POST pour éviter double envoi)
        if (isRetryableRequest(error) && config && config.method?.toLowerCase() !== 'post') {
            config._retryCount = (config._retryCount || 0) + 1;
            if (config._retryCount <= MAX_RETRIES) {
                await sleep(RETRY_DELAY_MS * config._retryCount);
                return api(config);
            }
        }

        if (isNetworkError(error) && !hasShownOfflineToast) {
            hasShownOfflineToast = true;
            toast.error('Serveur injoignable. Vérifiez la connexion au serveur.', {
                id: 'network-error',
                duration: 8000,
            });
            return Promise.reject(error);
        }

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
                    navigationService.navigate('/', { replace: true });
                }, 300);
            }
        } else if (status === 403) {
            if (error.response?.data?.code_erreur === 'LICENCE_INVALIDE') {
                if (window.location.pathname !== '/licence') {
                    navigationService.navigate('/licence', { replace: true });
                }
            } else if (!requestUrl.includes('verify-password')) {
                toast.error('Accès refusé : permissions insuffisantes', { id: 'access-denied' });
            }
        } else if (status === 429) {
            toast.error('Trop de tentatives. Attendez quelques instants.', { id: 'rate-limited', duration: 6000 });
        } else if (status >= 500) {
            toast.error('Erreur serveur. Réessayez plus tard.', { id: 'server-error' });
        }

        return Promise.reject(error);
    }
);


export default api;
