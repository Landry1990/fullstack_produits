// Configuration API pour l'application PDA
// Créer un fichier .env à la racine de pda-inventaire/ avec :
// EXPO_PUBLIC_API_BASE_URL=http://votre-ip:8000

import { Platform } from 'react-native';

// Fallback : localhost en web (même machine), IP locale pour device physique
const DEFAULT_API_URL = Platform.OS === 'web'
  ? 'http://localhost:8000'
  : 'http://192.168.1.181:8000';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_API_URL;

// Timeout des requêtes (ms)
export const REQUEST_TIMEOUT = 10000;

// Clés de stockage sécurisé
export const STORAGE_KEYS = {
    AUTH_TOKEN: 'pda_auth_token',
    USER_INFO: 'pda_user_info',
    LAST_SYNC: 'pda_last_sync',
    OFFLINE_QUEUE: 'pda_offline_queue',
};
