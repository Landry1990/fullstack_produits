/**
 * Service de synchronisation des factures
 * SQLite local → Serveur central (store-and-forward)
 * 
 * Règle critique : le mobile envoie un UUID temporaire,
 * le serveur renvoie le numéro de facture officiel séquentiel.
 */
import api, { classifyNetworkError } from './api';
import { invoiceRepo } from '../database';
import { SYNC_RETRY_DELAYS } from '../config';
import type { CreateInvoicePayload, SyncInvoiceResponse, Invoice, NetworkError } from '../types';

export interface InvoiceSyncResult {
  total: number;
  synced: number;
  errors: number;
  details: {
    uuid: string;
    success: boolean;
    serverNumber?: string;
    error?: string;
  }[];
}

/**
 * Synchronise toutes les factures en attente vers le serveur
 * Traite les factures en FIFO (ordre de création)
 * Continue avec les suivantes si une échoue (sync partielle)
 */
export async function syncPendingInvoices(): Promise<InvoiceSyncResult> {
  const pending = await invoiceRepo.getPending();
  
  if (pending.length === 0) {
    return { total: 0, synced: 0, errors: 0, details: [] };
  }

  console.log(`[InvoiceSync] ${pending.length} facture(s) à synchroniser…`);

  const result: InvoiceSyncResult = {
    total: pending.length,
    synced: 0,
    errors: 0,
    details: [],
  };

  for (const invoice of pending) {
    try {
      const payload = buildPayload(invoice);
      const response = await api.post<SyncInvoiceResponse>(
        '/api/factures/mobile/',
        payload
      );

      if (response.data.success) {
        // ✅ Marquer comme synchronisée avec le numéro officiel
        await invoiceRepo.markAsSynced(
          invoice.uuid,
          response.data.invoice_id,
          response.data.invoice_number
        );

        result.synced++;
        result.details.push({
          uuid: invoice.uuid,
          success: true,
          serverNumber: response.data.invoice_number,
        });

        console.log(
          `[InvoiceSync] ✅ ${invoice.uuid} → ${response.data.invoice_number}`
        );
      } else {
        throw new Error('Le serveur a refusé la facture');
      }
    } catch (error) {
      const networkError = classifyNetworkError(error);

      // Si c'est une erreur réseau (timeout, pas de connexion), on arrête
      // pour ne pas gaspiller des tentatives inutiles
      if (networkError.type === 'timeout' || networkError.type === 'no_connection') {
        console.warn(
          `[InvoiceSync] ⏸️ Réseau indisponible, arrêt de la synchronisation`
        );
        // Marquer les restantes en erreur temporaire ? Non — on les laisse 'pending'
        break;
      }

      // Erreur serveur (400, 500…) — marquer cette facture en erreur
      await invoiceRepo.markAsError(invoice.uuid, networkError.message);
      result.errors++;
      result.details.push({
        uuid: invoice.uuid,
        success: false,
        error: networkError.message,
      });

      console.error(
        `[InvoiceSync] ❌ ${invoice.uuid} — ${networkError.message}`
      );
    }
  }

  console.log(
    `[InvoiceSync] Résultat : ${result.synced}/${result.total} synchronisées, ${result.errors} erreurs`
  );

  return result;
}

/**
 * Synchronise une seule facture par UUID
 */
export async function syncSingleInvoice(
  uuid: string
): Promise<{ success: boolean; serverNumber?: string; error?: NetworkError }> {
  const invoice = await invoiceRepo.findByUuid(uuid);
  if (!invoice) {
    return {
      success: false,
      error: { type: 'unknown', message: 'Facture introuvable localement' },
    };
  }

  try {
    const payload = buildPayload(invoice);
    const response = await api.post<SyncInvoiceResponse>(
      '/api/factures/mobile/',
      payload
    );

    if (response.data.success) {
      await invoiceRepo.markAsSynced(
        uuid,
        response.data.invoice_id,
        response.data.invoice_number
      );
      return { success: true, serverNumber: response.data.invoice_number };
    }

    throw new Error('Le serveur a refusé la facture');
  } catch (error) {
    const networkError = classifyNetworkError(error);
    await invoiceRepo.markAsError(uuid, networkError.message);
    return { success: false, error: networkError };
  }
}

/**
 * Relance la synchronisation des factures en erreur
 * Remet leur statut à 'pending' puis déclenche un sync
 */
export async function retryErrorInvoices(): Promise<InvoiceSyncResult> {
  const errors = await invoiceRepo.getErrors();
  for (const invoice of errors) {
    await invoiceRepo.retryInvoice(invoice.uuid);
  }
  return syncPendingInvoices();
}

/**
 * Calcule le délai de retry avec backoff exponentiel
 * @param attempt Numéro de la tentative (0-indexed)
 */
export function getRetryDelay(attempt: number): number {
  const index = Math.min(attempt, SYNC_RETRY_DELAYS.length - 1);
  return SYNC_RETRY_DELAYS[index];
}

// ─── Helpers internes ────────────────────────────────────

/**
 * Construit le payload API à partir d'une facture locale
 */
function buildPayload(invoice: Invoice): CreateInvoicePayload {
  return {
    uuid: invoice.uuid,
    client: invoice.client,
    items: invoice.items.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
    })),
    total: invoice.total,
    created_at: invoice.date_creation,
  };
}
