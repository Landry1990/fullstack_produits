/**
 * Types pour le panier de vente en cours
 */
import { Product } from './product';

/** Ligne d'article dans le panier */
export interface CartItem {
  product: Product;
  quantity: number;
  unit_price: number;        // Prix unitaire au moment de l'ajout
  subtotal: number;          // quantity × unit_price
}

/** État du panier en cours (mémoire Zustand) */
export interface Cart {
  items: CartItem[];
  client: string | null;
  total: number;
  items_count: number;       // Nombre total d'articles (somme des quantités)
}
