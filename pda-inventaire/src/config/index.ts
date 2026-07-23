// Configuration API pour l'application PDA
// Modifier API_BASE_URL selon votre environnement

import { Platform } from 'react-native';

// localhost en web (même machine), IP locale pour device physique
export const API_BASE_URL = Platform.OS === 'web'
  ? 'http://localhost:8000'
  : 'http://192.168.1.181:8000';

// Timeout des requêtes (ms)
export const REQUEST_TIMEOUT = 10000;

// Clés de stockage sécurisé
export const STORAGE_KEYS = {
    AUTH_TOKEN: 'pda_auth_token',
    USER_INFO: 'pda_user_info',
    LAST_SYNC: 'pda_last_sync',
    OFFLINE_QUEUE: 'pda_offline_queue',
};
