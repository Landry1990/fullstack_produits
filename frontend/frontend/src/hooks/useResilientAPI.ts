import { useCallback, useRef, useState } from 'react';
import type { AxiosError, AxiosRequestConfig } from 'axios';
import api from '../services/api';
import { safeStorage } from '../utils/storage';
import { setAuthToken, buildBackendUrl } from '../services/api';
import { toast } from 'react-hot-toast';

// ============================================================================
// TYPES
// ============================================================================

export interface ResilienceConfig {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  timeout?: number;
  circuitBreakerThreshold?: number;
  circuitBreakerTimeout?: number;
}

export interface RequestState {
  loading: boolean;
  error: string | null;
  attempts: number;
}

export type ResilientRequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private readonly threshold: number;
  private readonly timeout: number;

  constructor(threshold = 5, timeout = 30000) {
    this.threshold = threshold;
    this.timeout = timeout;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.lastFailureTime && Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN - Service temporarily unavailable');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = null;
  }
}

// ============================================================================
// HOOK PRINCIPAL
// ============================================================================

export const useResilientAPI = (config: ResilienceConfig = {}) => {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    timeout = 30000,
    circuitBreakerThreshold = 5,
    circuitBreakerTimeout = 30000,
  } = config;

  // États
  const [requestState, setRequestState] = useState<RequestState>({
    loading: false,
    error: null,
    attempts: 0,
  });

  // Refs pour le circuit breaker et les timeouts
  const circuitBreakerRef = useRef(new CircuitBreaker(circuitBreakerThreshold, circuitBreakerTimeout));
  const abortControllerRef = useRef<AbortController | null>(null);

  // ============================================================================
  // FONCTIONS UTILITAIRES
  // ============================================================================

  /**
   * Calcule le délai avec backoff exponentiel et jitter
   */
  const calculateDelay = useCallback((attempt: number): number => {
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    const jitter = exponentialDelay * (0.5 + Math.random() * 0.5); // ±50% jitter
    return jitter;
  }, [baseDelay, maxDelay]);

  /**
   * Met en pause pendant un délai
   */
  const sleep = useCallback((ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  }, []);

  /**
   * Rafraîchit le token d'authentification
   */
  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const sessionStr = safeStorage.getItem('session');
      if (!sessionStr) return false;
      
      let session;
      try {
        session = JSON.parse(sessionStr);
      } catch {
        return false;
      }
      
      if (!session?.username || !session?.password) {
        return false;
      }

      const response = await fetch(buildBackendUrl('/api/auth/token/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: session.username,
          password: session.password,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.token) {
          safeStorage.setItem('authToken', data.token);
          setAuthToken(data.token);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  }, []);

  /**
   * Détermine si une erreur est retryable
   */
  const isRetryableError = useCallback((error: AxiosError): boolean => {
    if (!error.response) {
      // Erreur réseau (timeout, connexion perdue) -> retry
      return true;
    }

    const status = error.response.status;
    // Retry sur 5xx et certaines erreurs réseau
    if (status >= 500) return true;
    if (status === 408) return true; // Request Timeout
    if (status === 429) return true; // Too Many Requests
    // Pas de retry sur 4xx (client errors sauf 408, 429)
    return false;
  }, []);

  // ============================================================================
  // REQUÊTE PRINCIPALE
  // ============================================================================

  const request = useCallback(async <T = any>(
    method: ResilientRequestMethod,
    endpoint: string,
    data?: unknown,
    options: AxiosRequestConfig = {}
  ): Promise<T> => {
    // Annuler toute requête précédente
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setRequestState({ loading: true, error: null, attempts: 0 });

    const operation = async (): Promise<T> => {
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        setRequestState(prev => ({ ...prev, attempts: attempt + 1 }));

        try {
          const config: AxiosRequestConfig = {
            method,
            url: endpoint,
            data,
            timeout,
            signal: abortControllerRef.current?.signal,
            ...options,
          };

          const response = await api.request<T>(config);
          
          setRequestState({ loading: false, error: null, attempts: attempt + 1 });
          return response.data;

        } catch (error) {
          lastError = error as Error;
          const axiosError = error as AxiosError;

          // Gérer l'erreur 401 - Token expiré
          if (axiosError.response?.status === 401) {
            console.log(`🔄 Token expired on attempt ${attempt + 1}, refreshing...`);
            const refreshed = await refreshToken();
            if (refreshed) {
              // Retry immédiatement avec nouveau token
              continue;
            } else {
              throw new Error('Session expirée. Veuillez vous reconnecter.');
            }
          }

          // Vérifier si on doit retry
          if (!isRetryableError(axiosError) || attempt === maxRetries - 1) {
            throw error;
          }

          // Calculer et attendre le délai avant retry
          const delay = calculateDelay(attempt);
          console.log(`⏳ Retry ${attempt + 1}/${maxRetries} dans ${delay.toFixed(0)}ms...`);
          await sleep(delay);
        }
      }

      throw lastError || new Error('Request failed after retries');
    };

    try {
      // Exécuter avec circuit breaker
      const result = await circuitBreakerRef.current.execute(operation);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setRequestState({ loading: false, error: errorMessage, attempts: maxRetries });
      
      // Toast pour erreurs critiques
      if (circuitBreakerRef.current.getState() === 'OPEN') {
        toast.error('Service temporairement indisponible. Veuillez réessayer plus tard.', {
          duration: 5000,
          id: 'circuit-open',
        });
      }
      
      throw error;
    }
  }, [maxRetries, timeout, calculateDelay, sleep, refreshToken, isRetryableError]);

  // ============================================================================
  // METHODES CONVENIENCE
  // ============================================================================

  const get = useCallback(<T = any>(endpoint: string, options?: AxiosRequestConfig) =>
    request<T>('GET', endpoint, undefined, options), [request]);

  const post = useCallback(<T = any>(endpoint: string, data: unknown, options?: AxiosRequestConfig) =>
    request<T>('POST', endpoint, data, options), [request]);

  const put = useCallback(<T = any>(endpoint: string, data: unknown, options?: AxiosRequestConfig) =>
    request<T>('PUT', endpoint, data, options), [request]);

  const patch = useCallback(<T = any>(endpoint: string, data: unknown, options?: AxiosRequestConfig) =>
    request<T>('PATCH', endpoint, data, options), [request]);

  const del = useCallback(<T = any>(endpoint: string, options?: AxiosRequestConfig) =>
    request<T>('DELETE', endpoint, undefined, options), [request]);

  // ============================================================================
  // CONTRÔLES
  // ============================================================================

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setRequestState(prev => ({ ...prev, loading: false }));
  }, []);

  const reset = useCallback(() => {
    circuitBreakerRef.current.reset();
    setRequestState({ loading: false, error: null, attempts: 0 });
  }, []);

  const getCircuitState = useCallback(() => {
    return circuitBreakerRef.current.getState();
  }, []);

  // Cleanup
  const cleanup = useCallback(() => {
    cancel();
  }, [cancel]);

  return {
    // Méthodes HTTP
    request,
    get,
    post,
    put,
    patch,
    delete: del,

    // État
    loading: requestState.loading,
    error: requestState.error,
    attempts: requestState.attempts,
    circuitState: getCircuitState(),

    // Contrôles
    cancel,
    reset,
    cleanup,
  };
};

// ============================================================================
// HOOK SPÉCIALISÉ POUR LES OPÉRATIONS CRITIQUES
// ============================================================================

export const useResilientSale = () => {
  const api = useResilientAPI({
    maxRetries: 5,        // Plus de retry pour les ventes
    baseDelay: 500,       // Retry rapide
    circuitBreakerThreshold: 3, // Circuit sensible
  });

  const createSale = useCallback(async (saleData: {
    client_id?: number | null;
    mode_paiement: string;
    lignes: Array<{
      produit_id: number;
      quantite: number;
      prix_vente: number;
      total: number;
    }>;
    total_ttc: number;
    remise_globale?: number;
  }) => {
    // Idempotency key pour éviter les doublons
    const idempotencyKey = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return api.post('/factures/', saleData, {
      headers: {
        'X-Idempotency-Key': idempotencyKey,
      },
    });
  }, [api]);

  return {
    createSale,
    ...api,
  };
};

export const useResilientSearch = () => {
  const api = useResilientAPI({
    maxRetries: 2,        // Moins de retry pour la recherche
    timeout: 10000,      // Timeout court
    circuitBreakerThreshold: 10, // Circuit moins sensible
  });

  const search = useCallback(async (query: string, limit = 10) => {
    return api.get(`/omnisearch/?q=${encodeURIComponent(query)}&limit=${limit}`);
  }, [api]);

  return {
    search,
    ...api,
  };
};

export default useResilientAPI;
