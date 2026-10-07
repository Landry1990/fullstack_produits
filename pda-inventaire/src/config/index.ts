// Configuration API pour l'application PDA
// L'URL du serveur est désormais saisie et persistée via useAuthStore.
// L'adresse par défaut (http://192.168.1.181) est définie dans le store.

// Clés de stockage sécurisé (le token est géré par useAuthStore)
export const STORAGE_KEYS = {
    LAST_SYNC: 'pda_last_sync',
    OFFLINE_QUEUE: 'pda_offline_queue',
};
