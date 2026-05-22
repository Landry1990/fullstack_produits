/**
 * Service API — Gestion des lots (FEFO)
 */
import api from './api';
import type { StockLot } from '../types';

export const lotService = {
  /**
   * Récupère les lots disponibles pour un produit
   */
  async getLots(produitId: number): Promise<StockLot[]> {
    try {
      const response = await api.get(`/stock-lots/`, {
        params: { 
          produit: produitId, 
          ordering: 'date_expiration',
          include_empty: 'false'
        }
      });
      
      // Gérer différents formats de réponse
      const data = response.data;
      if (Array.isArray(data)) {
        return data;
      }
      if (data && Array.isArray(data.results)) {
        return data.results;
      }
      return [];
    } catch (error) {
      console.error('[LotService] Erreur récupération lots:', error);
      return [];
    }
  },

  /**
   * Formate la date d'expiration (MM/YY)
   */
  formatExpiry(dateStr: string | null): string {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(-2)}`;
  },

  /**
   * Calcule les jours restants avant expiration
   */
  getDaysUntilExpiry(dateStr: string | null): number | null {
    if (!dateStr) return null;
    const expiry = new Date(dateStr);
    const now = new Date();
    const diff = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  },

  /**
   * Retourne la couleur selon l'expiration (pour UI)
   */
  getExpiryColor(days: number | null): { color: string; urgent: boolean } {
    if (days === null) return { color: '#94a3b8', urgent: false };
    if (days < 0) return { color: '#ef4444', urgent: true }; // Expiré
    if (days < 30) return { color: '#f59e0b', urgent: true }; // < 30 jours
    return { color: '#22c55e', urgent: false }; // OK
  }
};
