/**
 * Repository des factures — Opérations CRUD SQLite async
 * Gère le cycle de vie : création locale → attente sync → synchronisée
 */
import { getDatabase } from './connection';
import { generateUUID, nowISO } from '../utils';
import type { Invoice, InvoiceItem, InvoiceRow, InvoiceStatus } from '../types';

// ─── Helpers de conversion ───────────────────────────────

/** Convertit une ligne brute SQLite en objet Invoice typé */
function rowToInvoice(row: InvoiceRow): Invoice {
  let items: InvoiceItem[] = [];
  try {
    items = JSON.parse(row.items_json);
  } catch {
    console.warn(`[DB] Erreur parsing items_json pour facture ${row.uuid}`);
  }

  return {
    id: row.id,
    uuid: row.uuid,
    date_creation: row.date_creation,
    client: row.client,
    total: row.total,
    items,
    status: row.status,
    server_id: row.server_id,
    server_number: row.server_number,
    error_message: row.error_message,
    synced_at: row.synced_at,
    created_at: row.created_at,
  };
}

// ─── Création ────────────────────────────────────────────

/**
 * Crée une nouvelle facture locale avec statut 'pending'
 * @returns L'Invoice créée avec son UUID temporaire
 */
export async function create(
  client: string | null,
  items: InvoiceItem[],
  total: number
): Promise<Invoice> {
  const db = await getDatabase();
  const uuid = generateUUID();
  const itemsJson = JSON.stringify(items);
  const now = nowISO();

  const result = await db.runAsync(
    `INSERT INTO pending_invoices (uuid, date_creation, client, total, items_json, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
    [uuid, now, client, total, itemsJson, now]
  );

  console.log(`[DB] Facture créée : ${uuid} (ID local: ${result.lastInsertRowId})`);

  return {
    id: result.lastInsertRowId,
    uuid,
    date_creation: now,
    client,
    total,
    items,
    status: 'pending',
    server_id: null,
    server_number: null,
    error_message: null,
    synced_at: null,
    created_at: now,
  };
}

// ─── Lecture ─────────────────────────────────────────────

/**
 * Récupère une facture par son ID local
 */
export async function findById(id: number): Promise<Invoice | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<InvoiceRow>(
    'SELECT * FROM pending_invoices WHERE id = ?',
    [id]
  );
  return row ? rowToInvoice(row) : null;
}

/**
 * Récupère une facture par son UUID
 */
export async function findByUuid(uuid: string): Promise<Invoice | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<InvoiceRow>(
    'SELECT * FROM pending_invoices WHERE uuid = ?',
    [uuid]
  );
  return row ? rowToInvoice(row) : null;
}

/**
 * Récupère toutes les factures en attente de synchronisation
 * Ordonnées par date de création (FIFO)
 */
export async function getPending(): Promise<Invoice[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<InvoiceRow>(
    `SELECT * FROM pending_invoices 
     WHERE status = 'pending' 
     ORDER BY date_creation ASC`
  );
  return rows.map(rowToInvoice);
}

/**
 * Récupère toutes les factures avec un statut d'erreur
 */
export async function getErrors(): Promise<Invoice[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<InvoiceRow>(
    `SELECT * FROM pending_invoices 
     WHERE status = 'error' 
     ORDER BY date_creation ASC`
  );
  return rows.map(rowToInvoice);
}

/**
 * Récupère les factures récentes (toutes statuts confondus)
 * @param limit Nombre max de résultats (défaut: 50)
 */
export async function getRecent(limit: number = 50): Promise<Invoice[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<InvoiceRow>(
    `SELECT * FROM pending_invoices 
     ORDER BY date_creation DESC 
     LIMIT ?`,
    [limit]
  );
  return rows.map(rowToInvoice);
}

/**
 * Compte les factures par statut
 */
export async function countByStatus(): Promise<Record<InvoiceStatus, number>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ status: InvoiceStatus; total: number }>(
    `SELECT status, COUNT(*) as total FROM pending_invoices GROUP BY status`
  );

  const result: Record<InvoiceStatus, number> = { pending: 0, synced: 0, error: 0 };
  for (const row of rows) {
    result[row.status] = row.total;
  }
  return result;
}

// ─── Mise à jour (Synchronisation) ──────────────────────

/**
 * Marque une facture comme synchronisée avec succès
 * Enregistre l'ID serveur et le numéro officiel
 */
export async function markAsSynced(
  uuid: string,
  serverId: number,
  serverNumber: string
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE pending_invoices 
     SET status = 'synced', server_id = ?, server_number = ?, synced_at = ?, error_message = NULL
     WHERE uuid = ?`,
    [serverId, serverNumber, nowISO(), uuid]
  );
  console.log(`[DB] Facture synchronisée : ${uuid} → ${serverNumber}`);
}

/**
 * Marque une facture en erreur de synchronisation
 */
export async function markAsError(uuid: string, errorMessage: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE pending_invoices 
     SET status = 'error', error_message = ?
     WHERE uuid = ?`,
    [errorMessage, uuid]
  );
  console.log(`[DB] Facture en erreur : ${uuid} — ${errorMessage}`);
}

/**
 * Remet une facture en erreur dans la file d'attente ('pending')
 * Pour relancer la synchronisation
 */
export async function retryInvoice(uuid: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE pending_invoices 
     SET status = 'pending', error_message = NULL
     WHERE uuid = ? AND status = 'error'`,
    [uuid]
  );
  console.log(`[DB] Facture remise en attente : ${uuid}`);
}

// ─── Suppression / Nettoyage ─────────────────────────────

/**
 * Supprime les factures synchronisées depuis plus de X jours
 * Nettoyage automatique pour ne pas encombrer la DB locale
 * @param daysOld Nombre de jours (défaut: 30)
 */
export async function cleanSynced(daysOld: number = 30): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `DELETE FROM pending_invoices 
     WHERE status = 'synced' 
     AND synced_at < datetime('now', 'localtime', ?)`,
    [`-${daysOld} days`]
  );
  if (result.changes > 0) {
    console.log(`[DB] ${result.changes} factures anciennes nettoyées`);
  }
  return result.changes;
}

/**
 * Supprime une facture par UUID (uniquement si pending ou error)
 * ⚠️ Ne pas supprimer les factures synced (intégrité)
 */
export async function deleteByUuid(uuid: string): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `DELETE FROM pending_invoices 
     WHERE uuid = ? AND status IN ('pending', 'error')`,
    [uuid]
  );
  return result.changes > 0;
}
