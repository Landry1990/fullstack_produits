/**
 * Instance Axios configurée pour le réseau local (LAN)
 * Gestion robuste des timeouts, intercepteurs auth, et erreurs réseau
 */
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { REQUEST_TIMEOUT, STORAGE_KEYS } from '../config';
import type { NetworkError } from '../types';

// ─── Instance Axios ──────────────────────────────────────

/** URL de base du serveur — initialisée dynamiquement via QR Code */
let baseURL = '';

/** Instance Axios avec timeout court pour réseau local */
const api = axios.create({
  timeout: REQUEST_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Configuration dynamique de l'URL ────────────────────

/**
 * Met à jour l'URL de base de l'API (appelé après scan QR Code)
 */
export function setBaseURL(url: string): void {
  baseURL = url.replace(/\/+$/, ''); // Retirer le slash final
  api.defaults.baseURL = baseURL;
  console.log(`[API] Base URL configurée : ${baseURL}`);
}

/**
 * Récupère l'URL de base courante
 */
export function getBaseURL(): string {
  return baseURL;
}

/**
 * Charge l'URL de base depuis le stockage sécurisé (au démarrage)
 */
export async function loadBaseURL(): Promise<boolean> {
  try {
    const savedUrl = await SecureStore.getItemAsync(STORAGE_KEYS.SERVER_URL);
    if (savedUrl) {
      setBaseURL(savedUrl);
      return true;
    }
  } catch (error) {
    console.warn('[API] Erreur chargement URL serveur:', error);
  }
  return false;
}

/**
 * Sauvegarde l'URL de base dans le stockage sécurisé
 */
export async function saveBaseURL(url: string): Promise<void> {
  setBaseURL(url);
  await SecureStore.setItemAsync(STORAGE_KEYS.SERVER_URL, url);
}

// ─── Callback déconnexion globale ────────────────────────

let onUnauthorizedCallback: (() => void) | null = null;

export function setUnauthorizedCallback(callback: () => void): void {
  onUnauthorizedCallback = callback;
}

// ─── Intercepteurs ───────────────────────────────────────

/** Intercepteur requête : injection automatique du token */
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // S'assurer que baseURL est défini
    if (!config.baseURL && baseURL) {
      config.baseURL = baseURL;
    }

    try {
      const token = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
      if (token) {
        config.headers.Authorization = `Token ${token}`;
      }
    } catch (error) {
      console.warn('[API] Erreur lecture token:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/** Intercepteur réponse : gestion 401 + classification des erreurs */
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expiré ou invalide — déconnexion forcée
      try {
        await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
        await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_INFO);
      } catch (_e) { /* ignore */ }

      if (onUnauthorizedCallback) {
        onUnauthorizedCallback();
      }
    }
    return Promise.reject(error);
  }
);

// ─── Utilitaire d'erreur réseau ──────────────────────────

/**
 * Classifie une erreur Axios en type d'erreur réseau exploitable
 */
export function classifyNetworkError(error: unknown): NetworkError {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;

    // Timeout
    if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
      return {
        type: 'timeout',
        message: 'Le serveur ne répond pas. Vérifiez la connexion Wi-Fi.',
      };
    }

    // Pas de réseau / serveur injoignable
    if (
      axiosError.code === 'ERR_NETWORK' ||
      axiosError.code === 'ECONNREFUSED' ||
      !axiosError.response
    ) {
      return {
        type: 'no_connection',
        message: 'Impossible de joindre le serveur. Vérifiez le réseau local.',
      };
    }

    // Erreur d'authentification
    if (axiosError.response?.status === 401 || axiosError.response?.status === 403) {
      return {
        type: 'auth_error',
        message: 'Session expirée. Veuillez vous reconnecter.',
        status: axiosError.response.status,
      };
    }

    // Erreur serveur (400+)
    if (axiosError.response?.status && axiosError.response.status >= 400) {
      const data = axiosError.response.data as any;
      let errorMessage = `Erreur serveur (${axiosError.response.status}).`;
      
      if (data) {
        if (data.non_field_errors && Array.isArray(data.non_field_errors)) {
          errorMessage = data.non_field_errors[0];
        } else if (data.detail) {
          errorMessage = data.detail;
        } else if (typeof data === 'string') {
          errorMessage = data;
        } else if (Object.keys(data).length > 0) {
          // Prendre la première erreur disponible si format inattendu
          const firstKey = Object.keys(data)[0];
          if (Array.isArray(data[firstKey])) {
            errorMessage = data[firstKey][0];
          } else if (typeof data[firstKey] === 'string') {
            errorMessage = data[firstKey];
          }
        }
      }

      return {
        type: 'server_error',
        message: errorMessage,
        status: axiosError.response.status,
      };
    }
  }

  return {
    type: 'unknown',
    message: 'Une erreur inattendue est survenue.',
  };
}

export default api;
