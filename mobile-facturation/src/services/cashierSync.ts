/**
 * Service de synchronisation avec la Caisse Centrale
 * Envoie les articles scannés au serveur principal
 */
import api from './api';
import type { CashierQueueItem, TicketCaisse } from '../types';

/**
 * Envoie une liste d'articles à la caisse centrale
 * Mode "Envoi à la Caisse" - Le PDA ne gère pas le paiement
 */
export async function sendToCashier(
  item: CashierQueueItem
): Promise<{ success: boolean; ticket?: TicketCaisse; error?: string }> {
  try {
    // Payload aligné avec l'API GestionDivers
    const payload = {
      pda_id: item.pda_id,
      pda_item_id: item.id,
      articles: item.lignes.map((l) => ({
        produit_id: l.produit.id,
        code_barre: l.produit.code_barre,
        designation: l.produit.designation,
        quantite: l.quantite,
        prix_unitaire: l.prix_unitaire,
        remise_produit: l.remise_produit,
        tva: l.tva,
        total_ht: l.total_ht,
        total_ttc: l.total_ttc,
      })),
      client_id: item.client?.id,
      client_name: item.client?.name,
      ayant_droit_id: item.ayant_droit?.id,
      ayant_droit_name: item.ayant_droit 
        ? `${item.ayant_droit.nom} ${item.ayant_droit.prenom}` 
        : undefined,
      taux_couverture: item.ayant_droit?.taux_couverture,
      total_estime: item.total_estime,
      articles_count: item.articles_count,
    };

    const response = await api.post('/mobile/cashier-queue', payload);

    if (response.data?.success) {
      return {
        success: true,
        ticket: response.data.ticket, // Ticket provisoire en attente de paiement
      };
    }

    return {
      success: false,
      error: response.data?.message || 'Erreur lors de l\'envoi à la caisse',
    };
  } catch (error: any) {
    console.error('[CashierSync] Erreur envoi caisse:', error);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Erreur réseau',
    };
  }
}

/**
 * Vérifie le statut d'un item dans la file d'attente caisse
 */
export async function checkCashierStatus(
  pdaItemId: string
): Promise<{
  status: 'waiting' | 'processing' | 'completed' | 'cancelled' | 'not_found';
  ticket?: TicketCaisse;
  position?: number; // Position dans la file (si waiting)
  error?: string;
}> {
  try {
    const response = await api.get(`/mobile/cashier-queue/${pdaItemId}/status`);

    if (response.data) {
      return {
        status: response.data.status,
        ticket: response.data.ticket,
        position: response.data.position,
      };
    }

    return { status: 'not_found' };
  } catch (error: any) {
    console.error('[CashierSync] Erreur check status:', error);
    return {
      status: 'not_found',
      error: error.message,
    };
  }
}

/**
 * Annule un item dans la file d'attente (si pas encore traité)
 */
export async function cancelCashierItem(
  pdaItemId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await api.post(`/mobile/cashier-queue/${pdaItemId}/cancel`, {
      reason: reason || 'Annulation PDA',
    });

    return {
      success: response.data?.success || false,
      error: response.data?.message,
    };
  } catch (error: any) {
    console.error('[CashierSync] Erreur annulation:', error);
    return {
      success: false,
      error: error.response?.data?.message || error.message,
    };
  }
}

/**
 * Récupère l'historique des tickets générés pour ce PDA
 */
export async function fetchTicketHistory(
  pdaId: string,
  limit: number = 20
): Promise<{ tickets: TicketCaisse[]; error?: string }> {
  try {
    const response = await api.get('/mobile/tickets', {
      params: { pda_id: pdaId, limit },
    });

    return {
      tickets: response.data?.tickets || [],
    };
  } catch (error: any) {
    console.error('[CashierSync] Erreur fetch history:', error);
    return {
      tickets: [],
      error: error.message,
    };
  }
}
