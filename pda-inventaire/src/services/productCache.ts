import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { Produit } from './inventaire';

const PRODUCTS_CACHE_DATE_KEY = 'pda_cached_products_date';
// Curseur de sync = server_time backend (l'horloge PDA n'est pas fiable)
const PRODUCTS_SYNCED_AT_KEY = 'pda_products_synced_server_at';
// URL du serveur pour lequel le cache a été rempli — un cache rempli pour
// une autre pharmacie doit être ignoré (même id produit ≠ même produit).
const PRODUCTS_SYNCED_SERVER_KEY = 'pda_products_synced_server_url';
// Ancien stockage AsyncStorage — trop volumineux (> 2 Mo, erreur CursorWindow Android)
const LEGACY_PRODUCTS_CACHE_KEY = 'pda_cached_products';
const CACHE_FILE = `${FileSystem.documentDirectory}pda_products_cache.json`;
// expo-file-system n'existe pas sur web → fallback localStorage (preview uniquement)
const IS_WEB = Platform.OS === 'web';
const WEB_CACHE_KEY = 'pda_products_cache_web';

export interface CachedProduct {
    id: number;
    name: string;
    cip1: string | null;
    cip2: string | null;
    cip3: string | null;
    cip4: string | null;
    stock: number;
    selling_price: number;
    cost_price?: number;
    use_lot_management?: boolean;
    stock_lots?: { id: number; lot: string; date_expiration: string | null; quantity_remaining: number }[];
    rayon?: { id: number; name: string };
}

class ProductCacheService {
    async getAll(): Promise<CachedProduct[]> {
        try {
            if (IS_WEB) {
                const cached = localStorage.getItem(WEB_CACHE_KEY);
                if (cached) return JSON.parse(cached);
            } else {
                const info = await FileSystem.getInfoAsync(CACHE_FILE);
                if (info.exists) {
                    const data = await FileSystem.readAsStringAsync(CACHE_FILE);
                    return JSON.parse(data);
                }
            }
            // Migration : ancien stockage AsyncStorage (échoue silencieusement si > 2 Mo)
            const legacy = await AsyncStorage.getItem(LEGACY_PRODUCTS_CACHE_KEY);
            return legacy ? JSON.parse(legacy) : [];
        } catch (error) {
            console.error('Erreur lecture cache produits:', error);
            return [];
        }
    }

    async saveAll(produits: CachedProduct[], syncedAt?: string): Promise<void> {
        try {
            if (IS_WEB) {
                localStorage.setItem(WEB_CACHE_KEY, JSON.stringify(produits));
            } else {
                await FileSystem.writeAsStringAsync(CACHE_FILE, JSON.stringify(produits));
            }
            await AsyncStorage.setItem(PRODUCTS_CACHE_DATE_KEY, new Date().toISOString());
            if (syncedAt) {
                await AsyncStorage.setItem(PRODUCTS_SYNCED_AT_KEY, syncedAt);
            }
            await AsyncStorage.removeItem(LEGACY_PRODUCTS_CACHE_KEY).catch(() => {});
        } catch (error) {
            console.error('Erreur sauvegarde cache produits:', error);
            throw error;
        }
    }

    async clear(): Promise<void> {
        try {
            if (IS_WEB) {
                localStorage.removeItem(WEB_CACHE_KEY);
            } else {
                await FileSystem.deleteAsync(CACHE_FILE, { idempotent: true });
            }
            await AsyncStorage.removeItem(PRODUCTS_CACHE_DATE_KEY);
            await AsyncStorage.removeItem(PRODUCTS_SYNCED_AT_KEY);
            await AsyncStorage.removeItem(PRODUCTS_SYNCED_SERVER_KEY);
            await AsyncStorage.removeItem(LEGACY_PRODUCTS_CACHE_KEY).catch(() => {});
        } catch (error) {
            console.error('Erreur nettoyage cache produits:', error);
        }
    }

    async getByCip(cip: string): Promise<CachedProduct | null> {
        const all = await this.getAll();
        const needle = cip.trim();
        return all.find(p =>
            (p.cip1 && p.cip1 === needle) ||
            (p.cip2 && p.cip2 === needle) ||
            (p.cip3 && p.cip3 === needle) ||
            (p.cip4 && p.cip4 === needle)
        ) || null;
    }

    async getCacheDate(): Promise<string | null> {
        return AsyncStorage.getItem(PRODUCTS_CACHE_DATE_KEY);
    }

    /** Curseur serveur pour la sync incrémentale (null si jamais syncé v2). */
    async getSyncedAt(): Promise<string | null> {
        return AsyncStorage.getItem(PRODUCTS_SYNCED_AT_KEY);
    }

    /** URL du serveur associée au cache (null si inconnue). */
    async getSyncedServerUrl(): Promise<string | null> {
        return AsyncStorage.getItem(PRODUCTS_SYNCED_SERVER_KEY);
    }

    async setSyncedServerUrl(url: string): Promise<void> {
        await AsyncStorage.setItem(PRODUCTS_SYNCED_SERVER_KEY, url);
    }

    async getCount(): Promise<number> {
        const all = await this.getAll();
        return all.length;
    }
}

export const productCacheService = new ProductCacheService();
