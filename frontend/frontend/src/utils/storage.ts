/**
 * Utilitaires de stockage sécurisé avec repli en mémoire (RAM)
 * pour éviter les SecurityError sur mobile ou en navigation privée.
 */

type StorageType = 'session' | 'local';

class MemoryStorage {
    private data: Map<string, string> = new Map();

    getItem(key: string): string | null {
        return this.data.get(key) || null;
    }

    setItem(key: string, value: string): void {
        this.data.set(key, value);
    }

    removeItem(key: string): void {
        this.data.delete(key);
    }

    clear(): void {
        this.data.clear();
    }
}

const memStorage = new MemoryStorage();

export const safeStorage = {
    /**
     * Tente de lire depuis le stockage réel, sinon utilise la mémoire
     */
    getItem(key: string, type: StorageType = 'session'): string | null {
        try {
            const storage = type === 'session' ? window.sessionStorage : window.localStorage;
            return storage.getItem(key);
        } catch (e) {
            console.warn(`SafeStorage: Accès refusé à ${type}Storage pour ${key}. Repli mémoire utilisé.`);
            return memStorage.getItem(`${type}_${key}`);
        }
    },

    /**
     * Tente d'écrire dans le stockage réel, sinon utilise la mémoire
     */
    setItem(key: string, value: string, type: StorageType = 'session'): void {
        try {
            const storage = type === 'session' ? window.sessionStorage : window.localStorage;
            storage.setItem(key, value);
        } catch (e) {
            console.warn(`SafeStorage: Impossible d'écrire dans ${type}Storage pour ${key}.`);
            memStorage.setItem(`${type}_${key}`, value);
        }
    },

    /**
     * Supprime une clé
     */
    removeItem(key: string, type: StorageType = 'session'): void {
        try {
            const storage = type === 'session' ? window.sessionStorage : window.localStorage;
            storage.removeItem(key);
        } catch (e) {
            memStorage.removeItem(`${type}_${key}`);
        }
    },

    /**
     * Vide tout (attention: vide aussi la mémoire)
     */
    clear(type: StorageType = 'session'): void {
        try {
            const storage = type === 'session' ? window.sessionStorage : window.localStorage;
            storage.clear();
        } catch (e) {
            // no-op pour le cache réel si inaccessible
        }
        memStorage.clear();
    }
};
