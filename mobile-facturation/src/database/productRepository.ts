/**
 * Repository des produits — Opérations CRUD SQLite async
 * Gère le catalogue local synchronisé depuis le serveur
 */
import { getDatabase } from './connection';
import type { Product, ProductFromServer } from '../types';

/**
 * Recherche un produit par son code-barres (exact match)
 */
export async function findByBarcode(codeBarre: string): Promise<Product | null> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<Product>(
    'SELECT * FROM products WHERE code_barre = ?',
    [codeBarre]
  );
  return result ?? null;
}

/**
 * Recherche un produit par son ID serveur
 */
export async function findById(id: number): Promise<Product | null> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<Product>(
    'SELECT * FROM products WHERE id = ?',
    [id]
  );
  return result ?? null;
}

/**
 * Recherche des produits par désignation (LIKE partiel)
 * @param query Terme de recherche
 * @param limit Nombre max de résultats (défaut: 20)
 */
export async function searchByDesignation(
  query: string,
  limit: number = 20
): Promise<Product[]> {
  const db = await getDatabase();
  const results = await db.getAllAsync<Product>(
    'SELECT * FROM products WHERE designation LIKE ? ORDER BY designation ASC LIMIT ?',
    [`%${query}%`, limit]
  );
  return results;
}

/**
 * Recherche combinée : code-barres exact OU désignation partielle
 */
export async function search(query: string, limit: number = 20): Promise<Product[]> {
  try {
    const db = await getDatabase();
    const trimmed = query.trim();
    console.log(`[DB] Recherche en cours pour: "${trimmed}"`);

    // Si c'est un code numérique, chercher d'abord par code-barres exact
    if (/^\d+$/.test(trimmed)) {
      const exactMatch = await findByBarcode(trimmed);
      if (exactMatch) {
        console.log(`[DB] Match exact trouvé pour barcode: ${trimmed}`);
        return [exactMatch];
      }
    }

    // Sinon, recherche par désignation ou code-barres partiel
    const results = await db.getAllAsync<Product>(
      `SELECT * FROM products 
       WHERE code_barre LIKE ? OR designation LIKE ? 
       ORDER BY designation ASC 
       LIMIT ?`,
      [`%${trimmed}%`, `%${trimmed}%`, limit]
    );
    console.log(`[DB] ${results.length} résultats trouvés pour "${trimmed}"`);
    return results;
  } catch (error) {
    console.error(`[DB] Erreur dans la recherche pour "${query}":`, error);
    throw error;
  }
}

/**
 * Récupère tous les produits du catalogue local
 * @param limit Nombre max (défaut: 100)
 */
export async function getAll(limit: number = 100): Promise<Product[]> {
  const db = await getDatabase();
  return db.getAllAsync<Product>(
    'SELECT * FROM products ORDER BY designation ASC LIMIT ?',
    [limit]
  );
}

/**
 * Compte le nombre total de produits en catalogue local
 */
export async function count(): Promise<number> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ total: number }>(
    'SELECT COUNT(*) as total FROM products'
  );
  return result?.total ?? 0;
}

/**
 * Insère ou met à jour un produit (UPSERT)
 * Utilisé lors de la synchronisation depuis le serveur
 */
export async function upsert(product: ProductFromServer): Promise<void> {
  const db = await getDatabase();
  
  if (!product || product.id === undefined || product.id === null) {
    console.warn('[DB] Tentative d\'insertion d\'un produit sans ID valide:', product);
    return;
  }

  const id = product.id;
  const codeBarre = (product.code_barre ?? product.cip1 ?? '').toString();
  const designation = (product.designation ?? product.name ?? 'Produit sans désignation').toString();
  
  let prixVente = 0;
  const rawPrix = product.prix_vente ?? product.selling_price;
  if (rawPrix !== undefined && rawPrix !== null) {
    prixVente = typeof rawPrix === 'number' ? rawPrix : parseFloat(rawPrix as any) || 0;
  }

  let stockLocal = 0;
  const rawStock = product.stock ?? product.total_stock;
  if (rawStock !== undefined && rawStock !== null) {
    stockLocal = typeof rawStock === 'number' ? rawStock : parseInt(rawStock as any, 10) || 0;
  }

  const lot = product.lot !== undefined && product.lot !== null ? product.lot.toString() : null;

  await db.runAsync(
    `INSERT INTO products (id, code_barre, designation, prix_vente, stock_local, lot, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
     ON CONFLICT(id) DO UPDATE SET
       code_barre = excluded.code_barre,
       designation = excluded.designation,
       prix_vente = excluded.prix_vente,
       stock_local = excluded.stock_local,
       lot = excluded.lot,
       updated_at = datetime('now', 'localtime')`,
    [id, codeBarre, designation, prixVente, stockLocal, lot]
  );
}

/**
 * Insère ou met à jour plusieurs produits en transaction (bulk sync)
 * Performance optimisée pour la synchronisation complète du catalogue
 */
export async function bulkUpsert(products: ProductFromServer[]): Promise<number> {
  const db = await getDatabase();
  let count = 0;

  await db.withTransactionAsync(async () => {
    for (const product of products) {
      if (!product || product.id === undefined || product.id === null) {
        console.warn('[DB] Ignorer un produit sans ID valide dans le bulk:', product);
        continue;
      }

      const id = product.id;
      const codeBarre = (product.code_barre ?? product.cip1 ?? '').toString();
      const designation = (product.designation ?? product.name ?? 'Produit sans désignation').toString();
      
      let prixVente = 0;
      const rawPrix = product.prix_vente ?? product.selling_price;
      if (rawPrix !== undefined && rawPrix !== null) {
        prixVente = typeof rawPrix === 'number' ? rawPrix : parseFloat(rawPrix as any) || 0;
      }

      let stockLocal = 0;
      const rawStock = product.stock ?? product.total_stock;
      if (rawStock !== undefined && rawStock !== null) {
        stockLocal = typeof rawStock === 'number' ? rawStock : parseInt(rawStock as any, 10) || 0;
      }

      const lot = product.lot !== undefined && product.lot !== null ? product.lot.toString() : null;

      await db.runAsync(
        `INSERT INTO products (id, code_barre, designation, prix_vente, stock_local, lot, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
         ON CONFLICT(id) DO UPDATE SET
           code_barre = excluded.code_barre,
           designation = excluded.designation,
           prix_vente = excluded.prix_vente,
           stock_local = excluded.stock_local,
           lot = excluded.lot,
           updated_at = datetime('now', 'localtime')`,
        [id, codeBarre, designation, prixVente, stockLocal, lot]
      );
      count++;
    }
  });

  console.log(`[DB] ${count} produits synchronisés avec succès`);
  return count;
}

/**
 * Supprime tous les produits du catalogue local
 * ⚠️ Utilisé avant une synchronisation complète (full refresh)
 */
export async function clearAll(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM products');
  console.log('[DB] Catalogue local vidé');
}
