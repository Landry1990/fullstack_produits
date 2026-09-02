import AsyncStorage from '@react-native-async-storage/async-storage';
import { Produit } from './inventaire';

const PRODUCTS_CACHE_KEY = 'pda_cached_products';
const PRODUCTS_CACHE_DATE_KEY = 'pda_cached_products_date';

export interface CachedProduct {
    id: number;
    name: string;
    cip1: string | null;
    cip2: string | null;
    cip3: string | null;
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
            const data = await AsyncStorage.getItem(PRODUCTS_CACHE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Erreur lecture cache produits:', error);
            return [];
        }
    }

    async saveAll(produits: CachedProduct[]): Promise<void> {
        try {
            await AsyncStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(produits));
            await AsyncStorage.setItem(PRODUCTS_CACHE_DATE_KEY, new Date().toISOString());
        } catch (error) {
            console.error('Erreur sauvegarde cache produits:', error);
            throw error;
        }
    }

    async clear(): Promise<void> {
        try {
            await AsyncStorage.removeItem(PRODUCTS_CACHE_KEY);
            await AsyncStorage.removeItem(PRODUCTS_CACHE_DATE_KEY);
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
            (p.cip3 && p.cip3 === needle)
        ) || null;
    }

    async getCacheDate(): Promise<string | null> {
        return AsyncStorage.getItem(PRODUCTS_CACHE_DATE_KEY);
    }

    async getCount(): Promise<number> {
        const all = await this.getAll();
        return all.length;
    }
}

export const productCacheService = new ProductCacheService();
