/**
 * Types pour les échanges API avec le serveur central
 */

/** Configuration du serveur (lue depuis QR Code) */
export interface ServerConfig {
  base_url: string;            // http://<IP>:<PORT>
  api_version?: string;
  server_name?: string;
}

/** Payload d'envoi de facture au serveur */
export interface CreateInvoicePayload {
  uuid: string;                // UUID temporaire généré côté mobile
  client: string | null;
  items: {
    product_id: number;
    quantity: number;
    unit_price: number;
  }[];
  total: number;
  created_at: string;          // Date de création locale (ISO string)
}

/** Réponse du serveur après création de facture */
export interface SyncInvoiceResponse {
  success: boolean;
  invoice_id: number;          // ID serveur
  invoice_number: string;      // Numéro officiel (ex: FAC-2026-00042)
}

/** Réponse API générique */
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

/** Réponse API paginée */
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** Payload d'authentification */
export interface LoginPayload {
  username: string;
  password: string;
}

/** Réponse d'authentification */
export interface LoginResponse {
  token: string;
  user: {
    id: number;
    username: string;
    first_name?: string;
    last_name?: string;
  };
}

/** Erreur réseau typée */
export interface NetworkError {
  type: 'timeout' | 'no_connection' | 'server_error' | 'auth_error' | 'unknown';
  message: string;
  status?: number;
}
