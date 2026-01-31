// Configuration API pour l'application PDA
// Modifier API_BASE_URL selon votre environnement

// Pour développement local sur le même réseau
// Remplacer par l'IP de votre machine (pas localhost pour device physique)
export const API_BASE_URL = 'http://192.168.1.192:8000';

// Timeout des requêtes (ms)
export const REQUEST_TIMEOUT = 10000;

// Durée de validité du token (ms) - 8 heures
export const TOKEN_VALIDITY = 8 * 60 * 60 * 1000;

// Clés de stockage sécurisé
export const STORAGE_KEYS = {
    AUTH_TOKEN: 'pda_auth_token',
    USER_INFO: 'pda_user_info',
    LAST_SYNC: 'pda_last_sync',
    OFFLINE_QUEUE: 'pda_offline_queue',
};

// Paramètres du scanner
export const SCANNER_CONFIG = {
    // Types de codes-barres supportés
    BARCODE_TYPES: ['ean13', 'ean8', 'code128', 'code39'],
    // Délai anti-rebond entre scans (ms)
    DEBOUNCE_MS: 500,
};
