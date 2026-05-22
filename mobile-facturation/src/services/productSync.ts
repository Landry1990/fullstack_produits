/**
 * Service de synchronisation du catalogue produits
 * Serveur → SQLite local (sens unique)
 */
import * as SecureStore from 'expo-secure-store';
import { AxiosResponse } from 'axios';
import api, { classifyNetworkError } from './api';
import { productRepo } from '../database';
import { STORAGE_KEYS } from '../config';
import type { ProductFromServer, PaginatedResponse, NetworkError } from '../types';

export interface SyncResult {
  success: boolean;
  count: number;
  error?: NetworkError;
}

/**
 * Synchronise le catalogue complet depuis le serveur vers SQLite
 * Télécharge tous les produits page par page et fait un bulk upsert
 */
export async function syncFullCatalog(): Promise<SyncResult> {
  try {
    console.log('[ProductSync] Début synchronisation complète du catalogue…');

    let allProducts: ProductFromServer[] = [];
    let nextUrl: string | null = '/api/produits/?page_size=500';

    // Pagination — télécharger toutes les pages
    while (nextUrl) {
      const response: AxiosResponse<PaginatedResponse<ProductFromServer>> = await api.get(nextUrl);
      allProducts = allProducts.concat(response.data.results);
      
      // Extraire le chemin relatif de l'URL next (qui peut contenir l'IP absolue)
      if (response.data.next) {
        const url = new URL(response.data.next);
        nextUrl = url.pathname + url.search;
      } else {
        nextUrl = null;
      }
    }

    // Vider d'abord le catalogue local pour éviter les orphelins et doublons
    await productRepo.clearAll();

    // Bulk upsert dans SQLite
    const count = await productRepo.bulkUpsert(allProducts);

    // Sauvegarder la date de dernière sync
    await SecureStore.setItemAsync(
      STORAGE_KEYS.LAST_PRODUCT_SYNC,
      new Date().toISOString()
    );

    console.log(`[ProductSync] Synchronisation terminée : ${count} produits`);
    return { success: true, count };
  } catch (error) {
    console.error('[ProductSync] Raw Error:', error);
    const networkError = classifyNetworkError(error);
    console.error('[ProductSync] Erreur synchronisation:', networkError.message);
    return { success: false, count: 0, error: networkError };
  }
}

/**
 * Synchronisation incrémentale — ne récupère que les produits modifiés
 * depuis la dernière synchronisation (gère la pagination)
 */
export async function syncUpdatedProducts(): Promise<SyncResult> {
  try {
    const lastSync = await SecureStore.getItemAsync(STORAGE_KEYS.LAST_PRODUCT_SYNC);

    // Si jamais sync effectuée, faire un full sync
    if (!lastSync) {
      return syncFullCatalog();
    }

    let allProducts: ProductFromServer[] = [];
    let nextUrl: string | null = `/api/produits/?modified_after=${encodeURIComponent(lastSync)}&page_size=500`;

    // Pagination pour récupérer tous les produits modifiés
    while (nextUrl) {
      const response: AxiosResponse<PaginatedResponse<ProductFromServer>> = await api.get(nextUrl);
      allProducts = allProducts.concat(response.data.results);
      
      if (response.data.next) {
        const url = new URL(response.data.next);
        nextUrl = url.pathname + url.search;
      } else {
        nextUrl = null;
      }
    }

    if (allProducts.length > 0) {
      const count = await productRepo.bulkUpsert(allProducts);
      
      await SecureStore.setItemAsync(
        STORAGE_KEYS.LAST_PRODUCT_SYNC,
        new Date().toISOString()
      );

      console.log(`[ProductSync] ${count} produits mis à jour`);
      return { success: true, count };
    }

    return { success: true, count: 0 };
  } catch (error) {
    const networkError = classifyNetworkError(error);
    console.error('[ProductSync] Erreur sync incrémentale:', networkError.message);
    return { success: false, count: 0, error: networkError };
  }
}

/**
 * Récupère la date de dernière synchronisation
 */
export async function getLastSyncDate(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(STORAGE_KEYS.LAST_PRODUCT_SYNC);
  } catch {
    return null;
  }
}
