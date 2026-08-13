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
        } catch {
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
        } catch {
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
        } catch {
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
        } catch {
            // no-op pour le cache réel si inaccessible
        }
        memStorage.clear();
    }
};

/**
 * Synchronise la sessionStorage d'un onglet ouvert via window.open() depuis l'onglet parent.
 * sessionStorage n'est PAS partagé entre onglets → un nouvel onglet (ex: page d'impression)
 * n'a pas le token d'auth → 401 → redirect login. Cette fonction copie les clés d'auth depuis
 * l'opener (same-origin uniquement) si la sessionStorage locale est vide.
 */
const SESSION_SYNC_KEYS = [
    'authToken', 'username', 'userId', 'is_superuser', 'allowed_menus',
    'can_do_returns', 'can_sell_negative_stock', 'can_cash_out',
    'can_delete_product', 'can_adjust_stock', 'can_delete_fournisseur',
    'can_delete_commande', 'can_close_commande', 'can_generate_coupon',
    'is_terminal_account', 'role', 'timeOffset',
];

const PRINT_AUTH_SYNC_KEY = 'zenith_print_auth_sync';

/**
 * Prépare la synchronisation d'auth pour les fenêtres d'impression ouvertes avec `noopener`.
 * Les clés d'auth sont copiées dans `localStorage` (partagé same-origin) juste avant `window.open`,
 * puis consommées par `consumePrintAuthSync()` dans l'onglet d'impression.
 */
export const preparePrintAuthSync = (): void => {
    try {
        const data: Record<string, string> = {};
        for (const key of SESSION_SYNC_KEYS) {
            const value = window.sessionStorage.getItem(key);
            if (value !== null) data[key] = value;
        }
        window.localStorage.setItem(PRINT_AUTH_SYNC_KEY, JSON.stringify(data));
    } catch {
        // localStorage inaccessible (navigation privée, quotas) : ignore silencieusement.
    }
};

/**
 * Consomme la synchronisation d'auth préparée par `preparePrintAuthSync()`.
 * Copie les clés dans `sessionStorage` et supprime la clé `localStorage`.
 */
export const consumePrintAuthSync = (): void => {
    try {
        const raw = window.localStorage.getItem(PRINT_AUTH_SYNC_KEY);
        if (!raw) return;
        const data = JSON.parse(raw) as Record<string, string>;
        for (const [key, value] of Object.entries(data)) {
            window.sessionStorage.setItem(key, value);
        }
        window.localStorage.removeItem(PRINT_AUTH_SYNC_KEY);
    } catch {
        // Données corrompues ou localStorage inaccessible : ignore.
    }
};

export const syncSessionFromOpener = (): void => {
    try {
        // Déjà un token ? Rien à faire.
        if (window.sessionStorage.getItem('authToken')) return;
        const opener = window.opener;
        if (!opener) return;
        // Accès cross-origin lève SecurityError → on s'arrête proprement.
        const openerStorage = opener.sessionStorage;
        for (const key of SESSION_SYNC_KEYS) {
            const value = openerStorage.getItem(key);
            if (value !== null) {
                window.sessionStorage.setItem(key, value);
            }
        }
    } catch {
        // Opener cross-origin ou inaccessible : ignore silencieusement.
    }
};
