/**
 * Types pour les produits du catalogue local
 */

/** Produit stocké dans SQLite (miroir simplifié du serveur) */
export interface Product {
  id: number;
  code_barre: string;       // EAN-13 ou CIP
  designation: string;
  prix_vente: number;
  tva: number;              // TVA applicable (ex: 18 pour 18%)
  stock_local: number;
  stock_lot?: number;       // Stock du lot spécifique
  lot: string | null;
  peremption?: string | null; // Date de péremption (ISO)
  cmm?: number;             // Consommation Moyenne Mensuelle
  updated_at: string;        // ISO datetime string
}

/** Produit reçu depuis l'API serveur (peut avoir des champs supplémentaires) */
export interface ProductFromServer {
  id: number;
  code_barre?: string;
  cip1?: string;
  designation?: string;
  name?: string;
  prix_vente?: number;
  selling_price?: number;
  stock?: number;
  total_stock?: number;
  lot?: string | null;
}

/** Paramètres de recherche de produit */
export interface ProductSearchParams {
  query?: string;
  code_barre?: string;
  limit?: number;
  offset?: number;
}
