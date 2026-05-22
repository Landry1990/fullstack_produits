/**
 * Types pour les factures (locales et synchronisées)
 */

/** Statut d'une facture locale */
export type InvoiceStatus = 'pending' | 'synced' | 'error';

/** Ligne d'article sérialisée dans items_json */
export interface InvoiceItem {
  product_id: number;
  code_barre: string;
  designation: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

/** Facture stockée localement dans SQLite */
export interface Invoice {
  id: number;                     // ID local (autoincrement SQLite)
  uuid: string;                   // UUID v4 temporaire
  date_creation: string;          // ISO datetime string
  client: string | null;
  total: number;
  items: InvoiceItem[];           // Désérialisé depuis items_json
  status: InvoiceStatus;
  server_id: number | null;       // ID serveur après sync réussie
  server_number: string | null;   // Numéro officiel (ex: FAC-2026-00042)
  error_message: string | null;   // Message d'erreur si échec sync
  synced_at: string | null;       // Date de synchronisation réussie
  created_at: string;
}

/** Ligne brute SQLite (items_json est un string JSON) */
export interface InvoiceRow {
  id: number;
  uuid: string;
  date_creation: string;
  client: string | null;
  total: number;
  items_json: string;
  status: InvoiceStatus;
  server_id: number | null;
  server_number: string | null;
  error_message: string | null;
  synced_at: string | null;
  created_at: string;
}
