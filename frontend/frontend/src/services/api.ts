import axios from 'axios';
import { gooeyToast } from 'goey-toast';
import { safeStorage } from '../utils/storage';
import * as navigationService from './navigationService';
import i18n from '../i18n';

const t = (key: string, fallback: string): string => {
    const translated = i18n.t(key, { ns: 'common', defaultValue: fallback });
    return translated;
};

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

const isNetworkError = (error: unknown): boolean => {
    const e = error as Record<string, unknown>;
    return !e.response && (e.code === 'ERR_NETWORK' || e.code === 'ECONNABORTED' || e.message === 'Network Error');
};

const isRetryableRequest = (error: unknown): boolean => {
    // Retry sur erreurs réseau (connexion perdue, timeout) et erreurs serveur temporaires
    const e = error as { response?: { status?: number } };
    const status = e.response?.status;
    const isServerTempUnavailable = status === 502 || status === 503 || status === 504;
    return isNetworkError(error) || isServerTempUnavailable;
};

let hasShownExpiredToast = false;
let hasShownOfflineToast = false;

window.addEventListener('online', () => {
    hasShownOfflineToast = false;
    gooeyToast.success(t('messages.connection_restored', 'Connexion serveur rétablie.'), {
        id: 'back-online',
        duration: 3000,
        style: {
            background: '#059669',
            color: '#fff',
            fontWeight: '600',
            padding: '12px 20px',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        },
        iconTheme: { primary: '#fff', secondary: '#059669' },
    });
});

window.addEventListener('offline', () => {
    gooeyToast.error(t('messages.network_offline', 'Connexion réseau perdue. Vérifiez votre réseau.'), {
        id: 'offline-warning',
        duration: Infinity,
        style: {
            background: '#dc2626',
            color: '#fff',
            fontWeight: '600',
            padding: '12px 20px',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        },
        iconTheme: { primary: '#fff', secondary: '#dc2626' },
    });
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
    (response) => {
        // Si on était hors-ligne et qu'une requête réussit, le serveur est de nouveau accessible
        if (hasShownOfflineToast) {
            hasShownOfflineToast = false;
            gooeyToast.dismiss('network-error');
            gooeyToast.success(t('messages.connection_restored', 'Connexion serveur rétablie.'), {
                id: 'back-online',
                duration: 3000,
                style: {
                    background: '#059669',
                    color: '#fff',
                    fontWeight: '600',
                    padding: '12px 20px',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                },
                iconTheme: { primary: '#fff', secondary: '#059669' },
            });
        }
        return response;
    },
    async (error: unknown) => {
        const err = error as Record<string, unknown> & { config?: Record<string, unknown> & { _retryCount?: number; method?: string } };
        const config = err.config;

        // Retry automatique sur les GET en cas de coupure réseau (jamais sur POST pour éviter double envoi)
        if (isRetryableRequest(error) && config && config.method?.toLowerCase() !== 'post') {
            config._retryCount = (config._retryCount || 0) + 1;
            if (config._retryCount <= MAX_RETRIES) {
                await sleep(RETRY_DELAY_MS * config._retryCount);
                return api(config);
            }
        }

        if (isNetworkError(error) && !hasShownOfflineToast && !navigator.onLine) {
            hasShownOfflineToast = true;
            gooeyToast.error(t('messages.server_unreachable', 'Impossible de joindre le serveur. Vérifiez la connexion.'), {
                id: 'network-error',
                duration: Infinity,
                style: {
                    background: '#dc2626',
                    color: '#fff',
                    fontWeight: '600',
                    padding: '12px 20px',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                },
                iconTheme: { primary: '#fff', secondary: '#dc2626' },
            });
            return Promise.reject(err);
        }

        const status = (err.response as { status?: number } | undefined)?.status;
        const requestUrl = String(err.config?.url ?? '');

        if (status === 401) {
            const currentPath = window.location.pathname;
            const onLoginPage = currentPath === '/' || currentPath === '/login';

            if (!hasShownExpiredToast && !onLoginPage) {
                hasShownExpiredToast = true;
                gooeyToast.error(t('messages.session_expired', 'Session expirée. Veuillez vous reconnecter.'), {
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
            const responseData = (err.response as { data?: { code_erreur?: string } } | undefined)?.data;
            if (responseData?.code_erreur === 'LICENCE_INVALIDE') {
                if (window.location.pathname !== '/licence') {
                    navigationService.navigate('/licence', { replace: true });
                }
            } else if (!requestUrl.includes('verify-password')) {
                gooeyToast.error(t('messages.access_denied', 'Accès refusé : permissions insuffisantes'), { id: 'access-denied' });
            }
        } else if (status === 429) {
            gooeyToast.error(i18n.t('common:messages.rate_limited', { defaultValue: 'Trop de tentatives. Attendez quelques instants.' }), { id: 'rate-limited', duration: 6000 });
        } else if (status !== undefined && status >= 500) {
            gooeyToast.error(t('messages.server_error', 'Erreur serveur. Réessayez plus tard.'), { id: 'server-error' });
        }

        return Promise.reject(err);
    }
);


export default api;
