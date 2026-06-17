/**
 * Service de ventes avec résilience intégrée
 * Wrappe venteService avec retry, circuit breaker, et gestion d'erreurs
 */

import { useCallback } from 'react';
import { useResilientAPI } from '../hooks/useResilientAPI';
import venteService from './venteService';
import type { Facture, PaginatedResponse } from '../types';
import type { SalesFilters, PageInitResponse } from './venteService';

export interface ResilientVenteService {
    // Même API que venteService mais avec résilience
    getPageInit: (params: SalesFilters) => Promise<PageInitResponse>;
    getFactures: (params: SalesFilters) => Promise<PaginatedResponse<Facture> | Facture[]>;
    finaliser: (data: any) => Promise<Facture>;
    modifier: (id: number, data: any) => Promise<{ facture: Facture; difference: number }>;
    getById: (id: number) => Promise<Facture>;
    update: (id: number, data: Partial<Facture>) => Promise<Facture>;
    deleteFacture: (id: number) => Promise<void>;
    bulkDelete: (ids: number[]) => Promise<{ deleted: number }>;
    
    // État
    loading: boolean;
    error: string | null;
    attempts: number;
}

/**
 * Hook pour utiliser le service de ventes avec résilience
 * 
 * Configuration spéciale pour les ventes :
 * - 5 retries max (opération critique)
 * - Retry rapide (500ms base)
 * - Circuit breaker sensible (3 échecs)
 * - Timeout 45s (création de facture peut être longue)
 */
export const useResilientVenteService = (): ResilientVenteService => {
    const resilient = useResilientAPI({
        maxRetries: 5,
        baseDelay: 500,
        maxDelay: 8000,
        timeout: 45000, // 45s pour création facture
        circuitBreakerThreshold: 3, // Circuit sensible
        circuitBreakerTimeout: 60000, // 1min de récupération
    });

    const { get, post, loading, error, attempts } = resilient;

    /**
     * Génère une clé d'idempotence pour éviter les doublons
     */
    const generateIdempotencyKey = useCallback((): string => {
        return crypto.randomUUID();
    }, []);

    /**
     * Charge l'initialisation de page avec retry
     */
    const getPageInit = useCallback(async (params: SalesFilters): Promise<PageInitResponse> => {
        return get('factures/page_init/', { params });
    }, [get]);

    /**
     * Récupère la liste des factures
     */
    const getFactures = useCallback(async (params: SalesFilters): Promise<PaginatedResponse<Facture> | Facture[]> => {
        return get('factures/', { params });
    }, [get]);

    /**
     * Récupère une facture par ID
     */
    const getById = useCallback(async (id: number): Promise<Facture> => {
        return get(`factures/${id}/`);
    }, [get]);

    /**
     * Met à jour une facture
     */
    const update = useCallback(async (id: number, data: Partial<Facture>): Promise<Facture> => {
        return resilient.patch(`factures/${id}/`, data);
    }, [resilient]);

    /**
     * Supprime une facture
     */
    const deleteFacture = useCallback(async (id: number): Promise<void> => {
        return resilient.delete(`factures/${id}/`);
    }, [resilient]);

    /**
     * Suppression en masse
     */
    const bulkDelete = useCallback(async (ids: number[]): Promise<{ deleted: number }> => {
        return post('factures/bulk_delete/', { ids });
    }, [post]);

    /**
     * FINALISER une vente - OPÉRATION CRITIQUE avec idempotence
     * 
     * Génère une clé d'idempotence pour éviter les doublons si retry
     */
    const finaliser = useCallback(async (data: any): Promise<Facture> => {
        // Si pas d'idempotence key fournie, en générer une
        const idempotencyKey = data.idempotency_key || generateIdempotencyKey();
        
        // Ajouter la clé d'idempotence aux données
        const dataWithIdempotency = {
            ...data,
            idempotency_key: idempotencyKey,
        };

        // Gestion FormData si image
        if (data.image_ordonnance instanceof File) {
            const formData = new FormData();
            const { image_ordonnance, ...jsonData } = dataWithIdempotency;
            formData.append('image_ordonnance', image_ordonnance);
            formData.append('json_data', JSON.stringify(jsonData));
            
            return post('factures/finaliser/', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'X-Idempotency-Key': idempotencyKey,
                },
            });
        }

        // JSON normal avec idempotence
        return post('factures/finaliser/', dataWithIdempotency, {
            headers: {
                'X-Idempotency-Key': idempotencyKey,
            },
        });
    }, [post, generateIdempotencyKey]);

    /**
     * Modifier une facture existante
     */
    const modifier = useCallback(async (id: number, data: any): Promise<{ facture: Facture; difference: number }> => {
        return post(`factures/${id}/modifier/`, data);
    }, [post]);

    return {
        getPageInit,
        getFactures,
        finaliser,
        modifier,
        getById,
        update,
        deleteFacture,
        bulkDelete,
        loading,
        error,
        attempts,
    };
};

/**
 * Version simple du service (sans hook) pour utilisation hors React
 * Utilise directement venteService avec un wrapper de base
 */
export const resilientVenteService = {
    /**
     * Finaliser avec retry manuel (pour utilisation hors hook)
     */
    finaliserWithRetry: async (
        data: any,
        maxRetries: number = 3,
        onRetry?: (attempt: number, error: Error) => void
    ): Promise<Facture> => {
        let lastError: Error | null = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await venteService.finaliser(data);
            } catch (error) {
                lastError = error as Error;
                
                // Vérifier si retryable
                const axiosError = error as any;
                if (axiosError.response?.status >= 400 && axiosError.response?.status < 500) {
                    // Erreur client, ne pas retry
                    throw error;
                }
                
                if (attempt < maxRetries) {
                    onRetry?.(attempt, lastError);
                    // Exponential backoff
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        throw lastError || new Error('Failed after retries');
    },
};

export default useResilientVenteService;
