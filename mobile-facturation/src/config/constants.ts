/**
 * Configuration de l'application mobile de facturation
 * Constantes, clés de stockage, paramètres scanner
 */

// ─── Réseau ──────────────────────────────────────────────
/** Timeout des requêtes HTTP (ms) — court pour détecter vite une coupure LAN */
export const REQUEST_TIMEOUT = 6000;

/** Délai entre les tentatives de synchronisation (ms) */
export const SYNC_RETRY_DELAYS = [2000, 4000, 8000, 16000, 30000] as const;

/** Durée de validité du token d'authentification (ms) — 8 heures */
export const TOKEN_VALIDITY = 8 * 60 * 60 * 1000;

// ─── Stockage Sécurisé ──────────────────────────────────
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'facturation_auth_token',
  USER_INFO: 'facturation_user_info',
  SERVER_URL: 'facturation_server_url',
  SERVER_CONFIG: 'facturation_server_config',
  LAST_PRODUCT_SYNC: 'facturation_last_product_sync',
} as const;

// ─── Base de Données Locale ──────────────────────────────
export const DB_NAME = 'facturation.db';

// ─── Scanner ─────────────────────────────────────────────
export const SCANNER_CONFIG = {
  /** Types de codes-barres supportés */
  BARCODE_TYPES: ['ean13', 'ean8', 'code128', 'code39'] as const,
  /** Délai anti-rebond entre deux scans (ms) */
  DEBOUNCE_MS: 500,
} as const;

// ─── Application ─────────────────────────────────────────
export const APP_CONFIG = {
  /** Nombre max de factures en attente avant alerte */
  MAX_PENDING_INVOICES_WARNING: 50,
  /** Intervalle de vérification de sync automatique (ms) */
  AUTO_SYNC_INTERVAL: 15000,
} as const;
